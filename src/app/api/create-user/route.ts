import { NextRequest, NextResponse } from 'next/server'
import { getUser, insertUser } from '@/drizzle/queries'

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
    
    console.log(`👤 Creating minimal user profile for: ${username}`)
    
    // Check if user already exists
    const existingUser = await getUser({ username })
    if (existingUser) {
      console.log(`👤 User ${username} already exists`)
      return NextResponse.json({
        success: true,
        username,
        existed: true
      })
    }
    
    // Create a minimal user profile
    const newUser = {
      username: username,
      lowercaseUsername: username.toLowerCase(),
      name: username, // Use username as display name initially
      profilePicture: '', // Empty for now
      description: '',
      location: '',
      url: '',
      fullProfile: {},
      followers: 0,
      profileScraped: true,
      wordwareStarted: false, // Will be set to true when tarot generation starts
      wordwareStartedTime: new Date(),
      tweetScrapeStartedTime: new Date(),
      paidWordwareStartedTime: new Date(),
      error: null,
    }
    
    await insertUser({ user: newUser })
    console.log(`👤 Minimal user profile created for: ${username}`)
    
    return NextResponse.json({
      success: true,
      username,
      existed: false
    })
    
  } catch (error) {
    console.error('Create user error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
} 