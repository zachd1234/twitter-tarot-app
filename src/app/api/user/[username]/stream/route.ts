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
      
      const sendUpdate = async () => {
        try {
          const user = await getUser({ username })
          if (!user) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'User not found' })}\n\n`))
            return
          }
          
          // Create a hash of the analysis to detect changes
          const currentAnalysisHash = user.analysis ? JSON.stringify(user.analysis) : ''
          const statusChanged = (user.wordwareCompleted ?? false) !== lastWordwareCompleted || 
                               (user.wordwareStarted ?? false) !== lastWordwareStarted
          
          // Send update if analysis changed or status changed
          if (currentAnalysisHash !== lastAnalysisHash || statusChanged) {
            console.log(`🌊 SSE: Sending update for ${username}`, {
              analysisChanged: currentAnalysisHash !== lastAnalysisHash,
              statusChanged,
              wordwareCompleted: user.wordwareCompleted,
              wordwareStarted: user.wordwareStarted,
              hasAnalysis: !!user.analysis
            })
            
            const updateData = {
              type: 'update',
              user: {
                username: user.username,
                wordwareStarted: user.wordwareStarted ?? false,
                wordwareCompleted: user.wordwareCompleted ?? false,
                analysis: user.analysis,
                timestamp: Date.now()
              }
            }
            
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(updateData)}\n\n`))
            
            // Update tracking variables
            lastAnalysisHash = currentAnalysisHash
            lastWordwareCompleted = user.wordwareCompleted ?? false
            lastWordwareStarted = user.wordwareStarted ?? false
          }
          
          // Stop streaming if analysis is completed
          if ((user.wordwareCompleted ?? false) && user.analysis) {
            console.log(`🌊 SSE: Analysis completed for ${username}, ending stream`)
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'completed', username })}\n\n`))
            clearInterval(intervalId)
            controller.close()
          }
        } catch (error) {
          console.error(`🌊 SSE: Error fetching user ${username}:`, error)
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: 'Failed to fetch user data' })}\n\n`))
        }
      }
      
      // Send initial update
      sendUpdate()
      
      // Set up polling interval
      intervalId = setInterval(sendUpdate, 1000) // Check every second
      
      // Cleanup function
      request.signal.addEventListener('abort', () => {
        console.log(`🌊 SSE: Client disconnected for ${username}`)
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