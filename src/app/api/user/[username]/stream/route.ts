import { NextRequest } from 'next/server'
import { getUser } from '@/drizzle/queries'

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  const { username } = params
  
  console.log(`🌊 SSE: Starting stream for user: ${username}`)

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      
      // Send initial connection message
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'connected', username })}\n\n`))
      
      let intervalId: NodeJS.Timeout
      let lastAnalysisHash = ''
      let lastWordwareCompleted = false
      let lastWordwareStarted = false
      let pollCount = 0
      let currentInterval = 1000 // Start with 1 second
      
      const pollForUpdates = async () => {
        try {
          const user = await getUser({ username })
          
          if (!user) {
            console.log(`🌊 SSE: User ${username} not found, ending stream`)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'User not found' })}\n\n`))
            controller.close()
            return
          }

          // Create a simple hash of the analysis to detect changes
          const analysisHash = user.analysis ? JSON.stringify(user.analysis).slice(0, 100) : ''
          
          // Check if there are meaningful changes
          const hasChanges = 
            analysisHash !== lastAnalysisHash ||
            (user.wordwareCompleted ?? false) !== lastWordwareCompleted ||
            (user.wordwareStarted ?? false) !== lastWordwareStarted

          if (hasChanges) {
            console.log(`🌊 SSE: Sending update for ${username}`, {
              wordwareStarted: user.wordwareStarted,
              wordwareCompleted: user.wordwareCompleted,
              hasAnalysis: !!user.analysis,
              hasProfilePicture: !!user.profilePicture
            })

            // Send the complete user data including profilePicture
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
              type: 'update', 
              user: {
                id: user.id,
                username: user.username,
                name: user.name,
                profilePicture: user.profilePicture,
                location: user.location,
                wordwareStarted: user.wordwareStarted ?? false,
                wordwareCompleted: user.wordwareCompleted ?? false,
                analysis: user.analysis
              }
            })}\n\n`))

            // Update tracking variables
            lastAnalysisHash = analysisHash
            lastWordwareCompleted = user.wordwareCompleted ?? false
            lastWordwareStarted = user.wordwareStarted ?? false
          }

          pollCount++

          // Terminate if analysis is complete
          if (user.wordwareCompleted && user.analysis) {
            console.log(`🌊 SSE: Analysis complete for ${username}, ending stream after ${pollCount} polls`)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', user })}\n\n`))
            clearInterval(intervalId)
            controller.close()
            return
          }

          // Use adaptive polling - start fast, slow down over time
          if (pollCount > 10) {
            clearInterval(intervalId)
            currentInterval = Math.min(currentInterval * 1.5, 10000) // Max 10 seconds
            console.log(`🌊 SSE: Slowing down polling to ${currentInterval}ms for ${username}`)
            intervalId = setInterval(pollForUpdates, currentInterval)
          }

          // Safety: terminate after 5 minutes to prevent runaway streams
          if (pollCount > 100) {
            console.log(`🌊 SSE: Safety termination for ${username} after ${pollCount} polls`)
            clearInterval(intervalId)
            controller.close()
          }

        } catch (error) {
          console.error(`🌊 SSE: Error polling for ${username}:`, error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Polling error' })}\n\n`))
        }
      }
      
      // Send initial update
      pollForUpdates()
      
      // Set up polling interval
      intervalId = setInterval(pollForUpdates, currentInterval)
      
      // Cleanup function
      request.signal.addEventListener('abort', () => {
        console.log(`🌊 SSE: Client disconnected for ${username} after ${pollCount} polls`)
        clearInterval(intervalId)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  })
} 