import { useEffect, useRef, useState } from 'react'

import { SelectPair, SelectUser } from '@/drizzle/schema'
import { useTwitterAnalysis } from '@/hooks/use-twitter-analysis'
import { PAIRS_PAYWALL } from '@/lib/config'
import { parsePartialJson } from '@/lib/parse-partial-json'
import { CompatibilityAnalysis, Steps } from '@/types'

type CompatibilitySteps = {
  user1Steps: Steps
  user2Steps: Steps
  compatibilityAnalysisStarted: boolean
  compatibilityAnalysisCompleted: boolean
}

export const useCompatibilityAnalysis = (user1: SelectUser, user2: SelectUser, pair: SelectPair) => {
  const { steps: user1Steps, result: user1Result } = useTwitterAnalysis(user1, true)
  const { steps: user2Steps, result: user2Result } = useTwitterAnalysis(user2, true)
  const [compatibilityResult, setCompatibilityResult] = useState<CompatibilityAnalysis | undefined>((pair.analysis as CompatibilityAnalysis) || undefined)
  const [steps, setSteps] = useState<CompatibilitySteps>({
    user1Steps,
    user2Steps,
    compatibilityAnalysisStarted: pair.wordwareStarted || false,
    compatibilityAnalysisCompleted: pair.wordwareCompleted || false,
  })
  const effectRan = useRef(false)

  useEffect(() => {
    if (PAIRS_PAYWALL && !pair.unlocked) return
    if (user1Steps.tweetScrapeCompleted && user2Steps.tweetScrapeCompleted && !steps.compatibilityAnalysisCompleted) {
      if (effectRan.current) return
      effectRan.current = true
      ;(async () => {
        setSteps((prev) => ({ ...prev, compatibilityAnalysisStarted: true }))
        const usernames = [user1.username, user2.username].sort()
        await handleCompatibilityAnalysis({ usernames, full: true })
        setSteps((prev) => ({ ...prev, compatibilityAnalysisCompleted: true }))
      })()
    }
  }, [user1.username, user2.username, user1Steps, user2Steps, steps.compatibilityAnalysisStarted, pair.unlocked])

  const handleCompatibilityAnalysis = async (props: { usernames: string[]; full: boolean }) => {
    if (steps.compatibilityAnalysisStarted && Date.now() - pair.wordwareStartedTime.getTime() < 2 * 60 * 1000) {
      console.log('Not starting compatibility analysis', steps.compatibilityAnalysisStarted, Date.now() - pair.wordwareStartedTime.getTime())
      return
    }
    const response = await fetch('/api/wordware/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(props),
    })

    if (!response.body) {
      console.error('No response body')
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        result += decoder.decode(value, { stream: true })
        console.log('🟣 | file: compatibility-analysis.tsx:68 | handleCompatibilityAnalysis | result:', result)

        const parsed = parsePartialJson(result) as any
        console.log('🟣 | file: compatibility-analysis.tsx:64 | handleCompatibilityAnalysis | parsed:', parsed)

        setCompatibilityResult({ ...parsed })
      }
    } catch (error) {
      console.error('Error reading stream', error)
    } finally {
      reader.releaseLock()
      return parsePartialJson(result)
    }
  }

  return {
    steps,
    user1Steps,
    user1Result,
    user2Steps,
    user2Result,
    compatibilityResult,
    unlocked: !PAIRS_PAYWALL || pair.unlocked || false,
  }
}
