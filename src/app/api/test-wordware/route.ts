import { NextRequest, NextResponse } from 'next/server'
import { callWordwareAPI } from '@/actions/actions'

export async function GET(request: NextRequest) {
  try {
    // Get Twitter handle from query params, default to 'elonmusk'
    const { searchParams } = new URL(request.url)
    const twitterHandle = searchParams.get('handle') || 'elonmusk'
    
    console.log(`🧪 Testing Wordware API with handle: @${twitterHandle}`)
    
    // Call the Wordware API
    const result = await callWordwareAPI({ twitterHandle })
    
    if (result.error) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        }, 
        { status: 500 }
      )
    }
    
    if (!result.data) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No data returned from API' 
        }, 
        { status: 500 }
      )
    }
    
    // Return the extracted fields with debugging info
    return NextResponse.json({
      success: true,
      twitterHandle,
      extractedFields: result.data,
      summary: {
        core_card: result.data.core_card_name,
        obstacle_card: result.data.obstacle_card_name,
        trajectory_card: result.data.trajectory_card_name,
        images_generated: [
          result.data.image1_url,
          result.data.image2_url,
          result.data.image3_url
        ].filter(Boolean).length,
        twitter_data_length: result.data.twitter_output?.length || 0
      },
      debug: {
        message: "If fields are empty, the API might be asynchronous or have a different structure"
      }
    })
    
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { twitterHandle } = body
    
    if (!twitterHandle) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'twitterHandle is required' 
        }, 
        { status: 400 }
      )
    }
    
    console.log(`🧪 Testing Wordware API with handle: @${twitterHandle}`)
    
    // Call the Wordware API
    const result = await callWordwareAPI({ twitterHandle })
    
    if (result.error) {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error 
        }, 
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      twitterHandle,
      extractedFields: result.data
    })
    
  } catch (error) {
    console.error('Test API error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    )
  }
} 