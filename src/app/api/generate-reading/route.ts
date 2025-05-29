import { NextRequest, NextResponse } from 'next/server'
import { handleNewUsername } from '@/actions/actions'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username } = body
    
    if (!username) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'username is required' 
        }, 
        { status: 400 }
      )
    }
    
    console.log(`🔮 Starting background tarot generation for: ${username}`)
    
    // Call handleNewUsername without redirect - this will run in the background
    const result = await handleNewUsername({ username })
    
    return NextResponse.json({
      success: true,
      username,
      result
    })
    
  } catch (error) {
    console.error('Background generation error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
} 