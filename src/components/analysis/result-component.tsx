'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

import { PriceButton } from '@/components/analysis/paywall-card'
import { SelectUser } from '@/drizzle/schema'
import { useTwitterAnalysis } from '@/hooks/use-twitter-analysis'
import { PERSONALITY_PART2_PAYWALL } from '@/lib/config'
import { TwitterAnalysis } from '@/types'

import ActionButtons from './action-buttons'
import { ProgressIndicator } from './progress-indicator'
import FlipTarotCard from './flip-tarot-card'

const ResultComponent = ({ user }: { user: SelectUser }) => {
  const renderTime = Date.now()
  console.log('🔄 ResultComponent: Rendering at timestamp:', renderTime)
  console.log('🔄 ResultComponent: Rendering with user:', {
    username: user.username,
    wordwareCompleted: user.wordwareCompleted,
    wordwareStarted: user.wordwareStarted,
    hasAnalysis: !!user.analysis,
    analysisKeys: user.analysis ? Object.keys(user.analysis) : []
  })

  const { steps, result, lastUpdateTime, forceRenderCounter } = useTwitterAnalysis(user)
  const [forceRenderKey, setForceRenderKey] = useState(0)
  const searchParams = useSearchParams()

  console.log('🔄 ResultComponent: Hook returned:', {
    steps,
    hasResult: !!result,
    resultKeys: result ? Object.keys(result) : [],
    lastUpdateTime,
    forceRenderCounter
  })

  const paywallFlag = posthog.getFeatureFlag('paywall2') ?? searchParams.get('stripe')

  // Force re-render when lastUpdateTime OR forceRenderCounter changes
  useEffect(() => {
    console.log('🔄 POLLING: lastUpdateTime changed, forcing re-render:', lastUpdateTime, 'counter:', forceRenderCounter)
    setForceRenderKey(prev => prev + 1)
  }, [lastUpdateTime, forceRenderCounter])

  // Extract tarot card data from the analysis
  const analysis = result || (user.analysis as TwitterAnalysis) || undefined
  
  console.log('🔄 ResultComponent: Final analysis data:', {
    fromResult: !!result,
    fromUser: !!user.analysis,
    finalAnalysis: !!analysis,
    analysisKeys: analysis ? Object.keys(analysis) : []
  })
  
  // Debug logging for image URLs
  console.log('🖼️ ResultComponent - Analysis data:', {
    image1_url: analysis?.image1_url,
    image2_url: analysis?.image2_url, 
    image3_url: analysis?.image3_url,
    core_symbol: analysis?.core_symbol,
    obstacle_symbol: analysis?.obstacle_symbol,
    trajectory_symbol: analysis?.trajectory_symbol,
    lastUpdateTime: lastUpdateTime
  })

  return (
    <div className="flex-center flex-col gap-8" key={`polling-${lastUpdateTime}-${forceRenderCounter}-${forceRenderKey}`}>
      <ProgressIndicator
        steps={steps}
        result={result}
        userUnlocked={!PERSONALITY_PART2_PAYWALL || user.unlocked || false}
      />
      
      {PERSONALITY_PART2_PAYWALL && !user.unlocked && (
        <PriceButton
          username={user.username}
          price={paywallFlag as string}
        />
      )}
      
      <ActionButtons
        shareActive={!!result?.about}
        text={`Check out my tarot reading by AI Agent, built on @wordware`}
        url={`https://twitter.wordware.ai/${user.username}`}
      />

      {/* Tarot Cards Grid */}
      <div className="w-full max-w-6xl" key={`cards-${forceRenderCounter}-${forceRenderKey}`}>
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Core Card */}
            <FlipTarotCard
              key={`core-${lastUpdateTime}-${forceRenderCounter}`}
              title="Core"
              cardName={analysis.core_card_name || ''}
              interpretation={analysis.core_interpretation || ''}
              imageUrl={analysis.image1_url || ''}
              symbol={analysis.core_symbol || '🔮'}
            />

            {/* Obstacle Card */}
            <FlipTarotCard
              key={`obstacle-${lastUpdateTime}-${forceRenderCounter}`}
              title="Obstacle"
              cardName={analysis.obstacle_card_name || ''}
              interpretation={analysis.obstacle_interpretation || ''}
              imageUrl={analysis.image2_url || ''}
              symbol={analysis.obstacle_symbol || '⚡'}
            />

            {/* Trajectory Card */}
            <FlipTarotCard
              key={`trajectory-${lastUpdateTime}-${forceRenderCounter}`}
              title="Trajectory"
              cardName={analysis.trajectory_card_name || ''}
              interpretation={analysis.trajectory_interpretation || ''}
              imageUrl={analysis.image3_url || ''}
              symbol={analysis.trajectory_symbol || '🚀'}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultComponent
