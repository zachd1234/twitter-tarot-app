'use client'

import { useSearchParams } from 'next/navigation'
import posthog from 'posthog-js'

import { PriceButton } from '@/components/analysis/paywall-card'
import { SelectUser } from '@/drizzle/schema'
import { useTwitterAnalysis } from '@/hooks/use-twitter-analysis'
import { PERSONALITY_PART2_PAYWALL } from '@/lib/config'
import { TwitterAnalysis } from '@/types'

import ActionButtons from './action-buttons'
import { ProgressIndicator } from './progress-indicator'
import TarotCard from './tarot-card'

const ResultComponent = ({ user }: { user: SelectUser }) => {
  const { steps, result } = useTwitterAnalysis(user)
  const searchParams = useSearchParams()

  const paywallFlag = posthog.getFeatureFlag('paywall2') ?? searchParams.get('stripe')

  // Extract tarot card data from the analysis
  const analysis = result as TwitterAnalysis
  
  const tarotCards = [
    {
      title: 'Core',
      symbol: analysis?.core_symbol || '🔮',
      cardName: analysis?.core_card_name || 'Loading...',
      interpretation: analysis?.core_interpretation || 'Your core essence is being revealed...',
      imageUrl: analysis?.image1_url || ''
    },
    {
      title: 'Obstacle',
      symbol: analysis?.obstacle_symbol || '⚡',
      cardName: analysis?.obstacle_card_name || 'Loading...',
      interpretation: analysis?.obstacle_interpretation || 'Your challenges are being analyzed...',
      imageUrl: analysis?.image2_url || ''
    },
    {
      title: 'Trajectory',
      symbol: analysis?.trajectory_symbol || '🚀',
      cardName: analysis?.trajectory_card_name || 'Loading...',
      interpretation: analysis?.trajectory_interpretation || 'Your path forward is being illuminated...',
      imageUrl: analysis?.image3_url || ''
    }
  ]

  // Extract guidance separately
  const guidance = analysis?.core_guidance

  return (
    <div className="flex-center flex-col gap-8">
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
      <div className="w-full max-w-6xl">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {tarotCards.map((card, index) => (
            <TarotCard
              key={index}
              title={card.title}
              symbol={card.symbol}
              cardName={card.cardName}
              interpretation={card.interpretation}
              imageUrl={card.imageUrl}
            />
          ))}
        </div>
        
        {/* Guidance Section - Centered Below All Cards */}
        {guidance && (
          <div className="mt-12 flex justify-center">
            <div className="max-w-2xl w-full">
              <div className="rounded-xl bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-100 p-8 text-center shadow-lg">
                <div className="mb-4">
                  <h3 className="text-2xl font-semibold text-gray-800 mb-2">✨ Your Guidance</h3>
                  <div className="w-16 h-1 bg-gradient-to-r from-purple-400 to-blue-400 mx-auto rounded-full"></div>
                </div>
                <p className="text-gray-700 leading-relaxed text-lg">{guidance}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ResultComponent
