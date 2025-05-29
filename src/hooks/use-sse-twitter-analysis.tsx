import { useEffect, useRef, useState } from 'react'
import { SelectUser } from '@/drizzle/schema'
import { Steps, TwitterAnalysis } from '@/types'

export const useSSETwitterAnalysis = (user: SelectUser, disableAnalysis: boolean = false) => {
  const [steps, setSteps] = useState<Steps>(initializeSteps(user))
  const [result, setResult] = useState<TwitterAnalysis | undefined>(user.analysis as TwitterAnalysis || undefined)
  const [currentUser, setCurrentUser] = useState<SelectUser>(user)
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(Date.now())
  
  const eventSourceRef = useRef<EventSource | null>(null)
  const effectRan = useRef(false)

  useEffect(() => {
    if (effectRan.current || disableAnalysis) {
      console.log('🌊 SSE: Effect skipped', { effectRan: effectRan.current, disableAnalysis })
      return
    }
    effectRan.current = true

    console.log('🌊 SSE: Starting SSE connection for user:', user.username)
    console.log('🌊 SSE: Initial user state:', {
      username: user.username,
      wordwareCompleted: user.wordwareCompleted,
      wordwareStarted: user.wordwareStarted,
      hasAnalysis: !!user.analysis
    })

    // Initialize result if analysis data is already available
    if (user.analysis) {
      console.log('✅ SSE: Analysis data already available, setting result:', user.analysis)
      setResult(user.analysis as TwitterAnalysis)
      setLastUpdateTime(Date.now())
    }

    // ALWAYS create EventSource connection for testing
    console.log('🌊 SSE: FORCE CONNECTING - Testing SSE connection regardless of completion status')
    
    // Create EventSource connection
    const streamUrl = `/api/user/${user.username}/stream`
    console.log('🌊 SSE: Creating EventSource connection to:', streamUrl)
    
    const eventSource = new EventSource(streamUrl)
    eventSourceRef.current = eventSource

    console.log('🌊 SSE: EventSource created, readyState:', eventSource.readyState)

    eventSource.onopen = () => {
      console.log('🌊 SSE: Connection opened for', user.username, 'readyState:', eventSource.readyState)
    }

    eventSource.onmessage = (event) => {
      try {
        console.log('🌊 SSE: Raw message received:', event.data)
        const data = JSON.parse(event.data)
        console.log('🌊 SSE: Parsed message:', data)

        switch (data.type) {
          case 'connected':
            console.log('🌊 SSE: Connected to stream for', data.username)
            break

          case 'update':
            const updatedUser = data.user
            console.log('🌊 SSE: Received user update:', {
              username: updatedUser.username,
              wordwareStarted: updatedUser.wordwareStarted,
              wordwareCompleted: updatedUser.wordwareCompleted,
              hasAnalysis: !!updatedUser.analysis,
              timestamp: updatedUser.timestamp
            })

            // Update current user state
            setCurrentUser(prev => ({
              ...prev,
              wordwareStarted: updatedUser.wordwareStarted,
              wordwareCompleted: updatedUser.wordwareCompleted,
              analysis: updatedUser.analysis
            }))

            // Update steps
            const newSteps = initializeSteps({
              ...user,
              wordwareStarted: updatedUser.wordwareStarted,
              wordwareCompleted: updatedUser.wordwareCompleted
            })
            setSteps(newSteps)

            // Update result if there's analysis data
            if (updatedUser.analysis) {
              console.log('🌊 SSE: Setting analysis result from stream:', updatedUser.analysis)
              setResult({ ...(updatedUser.analysis as TwitterAnalysis) })
            }

            // Always update timestamp to force re-render
            setLastUpdateTime(updatedUser.timestamp)
            console.log('🌊 SSE: Force re-render with timestamp:', updatedUser.timestamp)
            break

          case 'completed':
            console.log('🌊 SSE: Analysis completed for', data.username)
            // Keep connection open for a bit in case there are final updates
            setTimeout(() => {
              if (eventSourceRef.current) {
                eventSourceRef.current.close()
                eventSourceRef.current = null
              }
            }, 2000)
            break

          case 'error':
            console.error('🌊 SSE: Server error:', data.message)
            break

          default:
            console.log('🌊 SSE: Unknown message type:', data.type)
        }
      } catch (error) {
        console.error('🌊 SSE: Error parsing message:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('🌊 SSE: Connection error:', error)
      console.error('🌊 SSE: EventSource readyState:', eventSource.readyState)
      console.error('🌊 SSE: EventSource url:', eventSource.url)
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (!eventSourceRef.current || eventSourceRef.current.readyState === EventSource.CLOSED) {
          console.log('🌊 SSE: Attempting to reconnect...')
          // The useEffect will handle reconnection when component re-renders
        }
      }, 5000)
    }

    // Cleanup function
    return () => {
      console.log('🌊 SSE: Cleaning up connection for', user.username)
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [user.username, disableAnalysis])

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

  return { steps, result, currentUser, lastUpdateTime }
} 