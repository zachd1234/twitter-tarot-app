'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import posthog from 'posthog-js'

import { PriceButton } from '@/components/analysis/paywall-card'
import { SelectUser } from '@/drizzle/schema'
import { PERSONALITY_PART2_PAYWALL } from '@/lib/config'
import { TwitterAnalysis } from '@/types'

import ActionButtons from './action-buttons'
import { ProgressIndicator } from './progress-indicator'
import FlipTarotCard from './flip-tarot-card'

const ResultComponent = ({ user }: { user: SelectUser }) => {
  const renderTime = Date.now()
  console.log('🔄 ResultComponent: Rendering at timestamp:', renderTime)
  
  // State management
  const [currentUser, setCurrentUser] = useState<SelectUser>(user)
  const [analysis, setAnalysis] = useState<TwitterAnalysis | undefined>(user.analysis as TwitterAnalysis || undefined)
  const searchParams = useSearchParams()
  
  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isCompletedRef = useRef(false)

  console.log('🔄 ResultComponent: Current state:', {
    username: currentUser.username,
    wordwareCompleted: currentUser.wordwareCompleted,
    wordwareStarted: currentUser.wordwareStarted,
    hasAnalysis: !!analysis,
    analysisKeys: analysis ? Object.keys(analysis) : []
  })

  const paywallFlag = posthog.getFeatureFlag('paywall2') ?? searchParams.get('stripe')

  // Check if analysis is complete
  isCompletedRef.current = !!(currentUser.wordwareCompleted && analysis)

  useEffect(() => {
    console.log('🔄 Starting real-time updates for', user.username)
    
    // If analysis is already complete, no need for real-time updates
    if (isCompletedRef.current) {
      console.log('✅ Analysis already complete, skipping real-time updates')
      return
    }

    // Try SSE first, fallback to polling if SSE fails
    const startSSE = () => {
      try {
        console.log('🌊 Attempting SSE connection for', user.username)
        const eventSource = new EventSource(`/api/user/${user.username}/stream`)
        eventSourceRef.current = eventSource

        eventSource.onopen = () => {
          console.log('🌊 SSE connected for', user.username)
          // Clear any existing polling since SSE is working
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current)
            pollingIntervalRef.current = null
          }
        }

        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            
            if (data.type === 'update' && data.user) {
              console.log('🌊 SSE update received:', data.user.username)
              
              setCurrentUser(prev => ({
                ...prev,
                wordwareStarted: data.user.wordwareStarted,
                wordwareCompleted: data.user.wordwareCompleted,
                analysis: data.user.analysis
              }))

              if (data.user.analysis) {
                setAnalysis(data.user.analysis as TwitterAnalysis)
              }

              // Close SSE if analysis is complete
              if (data.user.wordwareCompleted && data.user.analysis) {
                console.log('✅ Analysis complete via SSE, closing connection')
                eventSource.close()
                eventSourceRef.current = null
              }
            }
          } catch (error) {
            console.error('🌊 SSE message parse error:', error)
          }
        }

        eventSource.onerror = (error) => {
          console.error('🌊 SSE error, falling back to polling:', error)
          eventSource.close()
          eventSourceRef.current = null
          startPolling()
        }

      } catch (error) {
        console.error('🌊 SSE setup failed, using polling:', error)
        startPolling()
      }
    }

    // Fallback polling (less aggressive)
    const startPolling = () => {
      if (pollingIntervalRef.current) return // Already polling
      
      console.log('📡 Starting fallback polling for', user.username)
      
      pollingIntervalRef.current = setInterval(async () => {
        try {
          const response = await fetch(`/api/user/${user.username}`)
          if (response.ok) {
            const updatedUser = await response.json()
            
            // Only update if there are actual changes
            const hasUserChanges = JSON.stringify(currentUser) !== JSON.stringify(updatedUser)
            
            if (hasUserChanges) {
              console.log('📡 Polling detected changes for', user.username)
              setCurrentUser(updatedUser)
              
              if (updatedUser.analysis) {
                setAnalysis(updatedUser.analysis as TwitterAnalysis)
              }
              
              // Stop polling if complete
              if (updatedUser.wordwareCompleted && updatedUser.analysis) {
                console.log('✅ Analysis complete via polling, stopping')
                if (pollingIntervalRef.current) {
                  clearInterval(pollingIntervalRef.current)
                  pollingIntervalRef.current = null
                }
              }
            }
          }
        } catch (error) {
          console.error('📡 Polling error:', error)
        }
      }, 3000) // Poll every 3 seconds instead of 1
    }

    // Start with SSE, fallback to polling
    startSSE()

    // Cleanup function
    return () => {
      console.log('🧹 Cleaning up real-time connections for', user.username)
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [user.username])

  // Simple steps calculation
  const steps = {
    profileScraped: currentUser.profileScraped || false,
    tweetScrapeStarted: currentUser.tweetScrapeStarted || false,
    tweetScrapeCompleted: currentUser.tweetScrapeCompleted || false,
    wordwareStarted: currentUser.wordwareStarted || false,
    wordwareCompleted: currentUser.wordwareCompleted || false,
    paidWordwareStarted: currentUser.paidWordwareStarted || false,
    paidWordwareCompleted: currentUser.paidWordwareCompleted || false,
  }

  console.log('🖼️ Analysis data:', {
    image1_url: analysis?.image1_url,
    image2_url: analysis?.image2_url, 
    image3_url: analysis?.image3_url
  })

  return (
    <div className="flex-center flex-col gap-8">
      <ProgressIndicator
        steps={steps}
        result={analysis}
        userUnlocked={!PERSONALITY_PART2_PAYWALL || user.unlocked || false}
      />
      
      {PERSONALITY_PART2_PAYWALL && !user.unlocked && (
        <PriceButton
          username={user.username}
          price={paywallFlag as string}
        />
      )}
      
      <ActionButtons
        shareActive={!!analysis?.about}
        text={`Check out my tarot reading by AI Agent, built on @wordware`}
        url={`https://twitter.wordware.ai/${user.username}`}
      />

      {/* Tarot Cards Grid */}
      <div className="w-full max-w-6xl">
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Core Card */}
            <FlipTarotCard
              key="core-card"
              title="Core"
              cardName={analysis.core_card_name || ''}
              interpretation={analysis.core_interpretation || ''}
              imageUrl={analysis.image1_url || ''}
              symbol={analysis.core_symbol || '🔮'}
            />

            {/* Obstacle Card */}
            <FlipTarotCard
              key="obstacle-card"
              title="Obstacle"
              cardName={analysis.obstacle_card_name || ''}
              interpretation={analysis.obstacle_interpretation || ''}
              imageUrl={analysis.image2_url || ''}
              symbol={analysis.obstacle_symbol || '⚡'}
            />

            {/* Trajectory Card */}
            <FlipTarotCard
              key="trajectory-card"
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
