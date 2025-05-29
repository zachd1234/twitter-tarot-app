import { useEffect, useRef, useState } from 'react'

import { SelectUser } from '@/drizzle/schema'
import { PERSONALITY_PART1_PAYWALL, PERSONALITY_PART2_PAYWALL } from '@/lib/config'
import { parsePartialJson } from '@/lib/parse-partial-json'
import { Steps, TwitterAnalysis } from '@/types'

/**
 * Custom hook for analyzing Twitter user data.
 *
 * @param {SelectUser} user - The user object containing Twitter profile information.
 * @param {boolean} [disableAnalysis=false] - Flag to disable the analysis process.
 * @returns {Object} An object containing the analysis steps and results.
 */

export const useTwitterAnalysis = (user: SelectUser, disableAnalysis: boolean = false) => {
  const [steps, setSteps] = useState<Steps>(initializeSteps(user))
  const [result, setResult] = useState<TwitterAnalysis | undefined>((user.analysis as TwitterAnalysis) || undefined)
  const [currentUser, setCurrentUser] = useState<SelectUser>(user)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now()) // Add timestamp for change detection
  const effectRan = useRef(false)
  const pollingInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (effectRan.current) return
    effectRan.current = true

    console.log('🔍 useTwitterAnalysis initial state:', {
      username: user.username,
      wordwareCompleted: user.wordwareCompleted,
      wordwareStarted: user.wordwareStarted,
      disableAnalysis,
      hasAnalysis: !!user.analysis,
      analysisKeys: user.analysis ? Object.keys(user.analysis) : []
    })

    // Initialize result if analysis data is already available
    if (user.analysis) {
      console.log('✅ Analysis data already available, setting result:', user.analysis)
      setResult(user.analysis as TwitterAnalysis)
    }

    // Start polling if:
    // 1. Analysis is not completed (wordwareCompleted is false)
    // 2. OR we don't have analysis data yet
    // 3. OR wordware is in progress (started but not completed)
    const shouldStartPolling = !disableAnalysis && (
      !user.wordwareCompleted || 
      !user.analysis ||
      (user.wordwareStarted && !user.wordwareCompleted)
    )

    // TEMPORARY: Force polling to always start for debugging
    const forcePolling = !disableAnalysis
    
    console.log('🔍 Polling decision:', {
      shouldStartPolling,
      forcePolling,
      wordwareCompleted: user.wordwareCompleted,
      hasAnalysis: !!user.analysis,
      wordwareStarted: user.wordwareStarted,
      disableAnalysis,
      conditions: {
        notWordwareCompleted: !user.wordwareCompleted,
        noAnalysis: !user.analysis,
        inProgress: user.wordwareStarted && !user.wordwareCompleted
      }
    })

    if (forcePolling) {
      console.log('🔄 FORCE POLLING: Starting polling for user updates...')
      startPolling()
    } else {
      console.log('❌ Polling not started - analysis already complete')
    }

    return () => {
      if (pollingInterval.current) {
        console.log('🧹 Cleaning up polling interval')
        clearInterval(pollingInterval.current)
      }
    }
  }, [])

  // Watch for changes in result and force re-render
  useEffect(() => {
    if (result) {
      console.log('🔄 Result changed, forcing re-render with timestamp:', Date.now())
      setLastUpdateTime(Date.now())
    }
  }, [result])

  const startPolling = () => {
    console.log('🔄 Starting polling for user updates...', user.username)
    
    pollingInterval.current = setInterval(async () => {
      try {
        console.log('📡 Polling for updates...', user.username)
        const response = await fetch(`/api/user/${user.username}`)
        if (response.ok) {
          const updatedUser = await response.json()
          console.log('📡 Received updated user:', {
            username: updatedUser.username,
            wordwareStarted: updatedUser.wordwareStarted,
            wordwareCompleted: updatedUser.wordwareCompleted,
            hasAnalysis: !!updatedUser.analysis,
            analysisKeys: updatedUser.analysis ? Object.keys(updatedUser.analysis) : [],
            fullAnalysis: updatedUser.analysis
          })
          
          // More aggressive change detection - compare against result state instead of currentUser
          const currentAnalysisString = result ? JSON.stringify(result) : 'null'
          const newAnalysisString = updatedUser.analysis ? JSON.stringify(updatedUser.analysis) : 'null'
          const hasNewAnalysis = newAnalysisString !== currentAnalysisString
          const statusChanged = updatedUser.wordwareCompleted !== currentUser.wordwareCompleted || 
                               updatedUser.wordwareStarted !== currentUser.wordwareStarted
          
          console.log('📡 Change detection:', {
            hasNewAnalysis,
            statusChanged,
            currentAnalysisLength: currentAnalysisString.length,
            newAnalysisLength: newAnalysisString.length,
            currentWordwareCompleted: currentUser.wordwareCompleted,
            newWordwareCompleted: updatedUser.wordwareCompleted
          })
          
          // Always update currentUser state
          setCurrentUser(updatedUser)
          console.log('📡 Updated currentUser state')
          
          // Always update steps
          const newSteps = initializeSteps(updatedUser)
          setSteps(newSteps)
          console.log('📡 Updated steps:', newSteps)
          
          // Update result and force re-render if there's any analysis data
          if (updatedUser.analysis) {
            console.log('📡 Setting analysis result from polling:', updatedUser.analysis)
            // Always create a new object reference and update timestamp
            setResult({ ...(updatedUser.analysis as TwitterAnalysis) })
            setLastUpdateTime(Date.now()) // Always update timestamp to force re-render
            console.log('📡 Force re-render with new timestamp:', Date.now())
          }
          
          // Also force update if status changed but no analysis yet
          if (statusChanged && !updatedUser.analysis) {
            setLastUpdateTime(Date.now())
            console.log('📡 Force re-render due to status change:', Date.now())
          }
          
          // Stop polling if analysis is completed
          if (updatedUser.wordwareCompleted) {
            console.log('✅ Analysis completed, stopping polling')
            if (pollingInterval.current) {
              clearInterval(pollingInterval.current)
              pollingInterval.current = null
            }
          }
        } else {
          console.error('❌ Polling response not ok:', response.status)
        }
      } catch (error) {
        console.error('❌ Error polling for updates:', error)
      }
    }, 2000) // Poll every 2 seconds
  }

  function initializeSteps(user: SelectUser): Steps {
    return {
      profileScraped: user.profileScraped || false,
      tweetScrapeStarted: user.tweetScrapeStarted || false,
      tweetScrapeCompleted: user.tweetScrapeCompleted || false,
      wordwareStarted: user.wordwareStarted || false,
      wordwareCompleted: user.wordwareCompleted || false,
      paidWordwareStarted: user.paidWordwareStarted || false,
      paidWordwareCompleted: user.paidWordwareCompleted || false,
    }
  }

  const handleTweetAnalysis = async (props: { username: string; full: boolean; currentAnalysis?: TwitterAnalysis | undefined }) => {
    const response = await fetch('/api/wordware', {
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

        const parsed = parsePartialJson(result) as TwitterAnalysis

        const existingAnalysis = {
          ...(user.analysis as TwitterAnalysis),
          ...props.currentAnalysis,
        }

        setResult({ ...existingAnalysis, ...parsed })
      }
    } catch (error) {
      console.error('Error reading stream', error)
    } finally {
      reader.releaseLock()
      return parsePartialJson(result)
    }
  }

  const shouldRunWordwareAnalysis = (user: SelectUser): boolean => {
    const unlockedCheck = PERSONALITY_PART1_PAYWALL ? user.unlocked || false : true
    return (
      (unlockedCheck && !user.wordwareStarted) ||
      (unlockedCheck && !user.wordwareCompleted && Date.now() - user.wordwareStartedTime.getTime() > 60 * 1000)
    )
  }

  const shouldRunPaidWordwareAnalysis = (user: SelectUser, result: TwitterAnalysis | undefined): boolean => {
    const unlockedCheck = PERSONALITY_PART2_PAYWALL ? user.unlocked || false : true
    console.log('🟣 | file: twitter-analysis.tsx:117 | shouldRunPaidWordwareAnalysis | unlockedCheck:', unlockedCheck)
    const verdict =
      (!user.paidWordwareCompleted &&
        (!result || !result.loveLife) &&
        ((user.unlocked && !user.paidWordwareStarted) ||
          (user.unlocked && !user.paidWordwareCompleted && Date.now() - user.paidWordwareStartedTime.getTime() > 60 * 1000))) ||
      false

    console.log('🟣 | file: twitter-analysis.tsx:119 | shouldRunPaidWordwareAnalysis | verdict:', verdict)
    return unlockedCheck || verdict
  }

  const runWordwareAnalysis = async (user: SelectUser, setSteps: React.Dispatch<React.SetStateAction<Steps>>) => {
    setSteps((prev) => ({ ...prev, wordwareStarted: true }))
    const result = await handleTweetAnalysis({ username: user.username, full: false })
    setSteps((prev) => ({ ...prev, wordwareCompleted: true }))
    return result as TwitterAnalysis
  }

  const runPaidWordwareAnalysis = async (user: SelectUser, setSteps: React.Dispatch<React.SetStateAction<Steps>>, result: TwitterAnalysis | undefined) => {
    setSteps((prev) => ({ ...prev, paidWordwareStarted: true }))
    await handleTweetAnalysis({ username: user.username, full: true, currentAnalysis: result })
    setSteps((prev) => ({ ...prev, paidWordwareCompleted: true }))
  }

  return { steps, result, currentUser, lastUpdateTime }
}
