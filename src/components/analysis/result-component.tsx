'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import posthog from 'posthog-js'

import { PriceButton } from '@/components/analysis/paywall-card'
import { SelectUser } from '@/drizzle/schema'
import { useSSETwitterAnalysis } from '@/hooks/use-sse-twitter-analysis'
import { PERSONALITY_PART2_PAYWALL } from '@/lib/config'
import { TwitterAnalysis } from '@/types'

import ActionButtons from './action-buttons'
import { ProgressIndicator } from './progress-indicator'
import FlipTarotCard from './flip-tarot-card'

const ResultComponent = ({ user }: { user: SelectUser }) => {
  const { steps, result, lastUpdateTime } = useSSETwitterAnalysis(user)
  const [forceRenderKey, setForceRenderKey] = useState(0)
  const searchParams = useSearchParams()

  const paywallFlag = posthog.getFeatureFlag('paywall2') ?? searchParams.get('stripe')

  // Force re-render when lastUpdateTime changes
  useEffect(() => {
    console.log('🔄 SSE: lastUpdateTime changed, forcing re-render:', lastUpdateTime)
    setForceRenderKey(prev => prev + 1)
  }, [lastUpdateTime])

  // Extract tarot card data from the analysis
  const analysis = result || undefined
  
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
    <div className="flex-center flex-col gap-8" key={`sse-${lastUpdateTime}-${forceRenderKey}`}>
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
      <div className="w-full max-w-6xl" key={`cards-${forceRenderKey}`}>
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Core Card */}
            <FlipTarotCard
              key={`core-${lastUpdateTime}`}
              title="Core"
              cardName={analysis.core_card_name || ''}
              interpretation={analysis.core_interpretation || ''}
              imageUrl={analysis.image1_url || ''}
              symbol={analysis.core_symbol || '🔮'}
            />

            {/* Obstacle Card */}
            <FlipTarotCard
              key={`obstacle-${lastUpdateTime}`}
              title="Obstacle"
              cardName={analysis.obstacle_card_name || ''}
              interpretation={analysis.obstacle_interpretation || ''}
              imageUrl={analysis.image2_url || ''}
              symbol={analysis.obstacle_symbol || '⚡'}
            />

            {/* Trajectory Card */}
            <FlipTarotCard
              key={`trajectory-${lastUpdateTime}`}
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
