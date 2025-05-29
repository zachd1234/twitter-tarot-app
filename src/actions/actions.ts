'use server'

import { unstable_noStore as noStore, revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { scrapeProfileApify } from '@/core/apify'
import { scrapeTweets } from '@/core/logic'
import { getPair, getUser, insertPair, insertUser, unlockPair, unlockUser, updateUser } from '@/drizzle/queries'
import { createLoopsContact } from '@/lib/loops'

import { fetchUserDataBySocialData } from '../core/social-data'
import { fetchUserData } from '../core/twitter-api'

// Wordware API types
interface WordwareAnalysis {
  core: {
    symbol: string
    card_name: string
    interpretation: string
    guidance: string
  }
  obstacle: {
    symbol: string
    card_name: string
    interpretation: string
  }
  trajectory: {
    symbol: string
    card_name: string
    interpretation: string
  }
}

interface WordwareResponse {
  'Twitter scraper': {
    output: string
  }
  analysis: WordwareAnalysis
  IMG1: {
    finalPrompt: string
    'ImageGenHelper vertical': {
      'Image generation': {
        output: {
          type: string
          image_url: string
        }
      }
    }
  }
  IMG2: {
    finalPrompt: string
    'ImageGenHelper vertical': {
      'Image generation': {
        output: {
          type: string
          image_url: string
        }
      }
    }
  }
  Profile: {
    finalPrompt: string
    profilePrompt: {
      code: string
      logs: string
      error: string
      output: string
    }
    'Image generation': {
      output: {
        type: string
        image_url: string
      }
    }
  }
  IMG3: {
    finalPrompt: string
    'ImageGenHelper vertical': {
      'Image generation': {
        output: {
          type: string
          image_url: string
        }
      }
    }
  }
  Profile2: {
    finalPrompt: string
    'Image generation': {
      type: string
      image_url: string
    }
  }
}

interface ExtractedWordwareFields {
  // Twitter data
  twitter_output: string
  
  // Core analysis
  core_symbol: string
  core_card_name: string
  core_interpretation: string
  core_guidance: string
  
  // Obstacle analysis
  obstacle_symbol: string
  obstacle_card_name: string
  obstacle_interpretation: string
  
  // Trajectory analysis
  trajectory_symbol: string
  trajectory_card_name: string
  trajectory_interpretation: string
  
  // Image URLs
  image1_url: string
  image2_url: string
  image3_url: string
  
  // Image prompts
  image1_prompt: string
  image2_prompt: string
  image3_prompt: string
  
  // Profile data
  profile_output: string
  profile_picture_url: string
}

export const callWordwareAPI = async ({ twitterHandle }: { twitterHandle: string }): Promise<{ data: ExtractedWordwareFields | null; error: string | null }> => {
  try {
    const apiKey = process.env.WORDWARE_API_KEY
    if (!apiKey) {
      throw new Error('WORDWARE_API_KEY environment variable is not set')
    }

    console.log('🚀 Making API call to Wordware with handle:', twitterHandle)

    // Step 1: Start the run
    const response = await fetch('https://api.wordware.ai/v1/apps/e4b7bc36-742f-4a84-a9b3-c64c3f73e976/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        data: {
          type: 'runs',
          attributes: {
            version: '6.3',
            inputs: {
              twitterHandle: twitterHandle
            },
            webhooks: []
          }
        }
      })
    })

    console.log('📡 Response status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Wordware API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const runData = await response.json()
    console.log('🔍 Run started:', runData.data.attributes.status)
    
    // Step 2: Get the stream URL and fetch results
    const streamUrl = runData.data.links.stream
    console.log('🌊 Streaming from:', streamUrl)
    
    const streamResponse = await fetch(streamUrl, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      }
    })

    if (!streamResponse.ok) {
      const errorText = await streamResponse.text()
      throw new Error(`Stream error: ${streamResponse.status} ${streamResponse.statusText} - ${errorText}`)
    }

    // Step 3: Process the stream with better error handling
    const reader = streamResponse.body?.getReader()
    if (!reader) {
      throw new Error('Failed to get stream reader')
    }

    const decoder = new TextDecoder()
    let finalOutputs: any = {}
    let isCompleted = false
    
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('📡 Stream ended')
          break
        }
        
        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')
        
        for (const line of lines) {
          if (line.trim() && line.startsWith('data: ')) {
            try {
              const jsonString = line.slice(6)
              
              // Skip lines that are clearly malformed (contain unescaped quotes in long strings)
              if (jsonString.includes('SyntaxError') || jsonString.includes('Unterminated string')) {
                console.warn('⚠️ Skipping malformed JSON line')
                continue
              }
              
              const data = JSON.parse(jsonString)
              console.log('📦 Stream data:', data)
              
              // Handle different types of stream data
              if (data.type === 'value' && data.path && data.value !== undefined) {
                console.log('🔍 Stream value received:', { path: data.path, value: data.value })
                
                // Set nested values using dot notation path
                const pathParts = data.path.split('.')
                let current = finalOutputs
                
                // Navigate to the correct nested location
                for (let i = 0; i < pathParts.length - 1; i++) {
                  const part = pathParts[i]
                  if (!current[part]) {
                    current[part] = {}
                  }
                  current = current[part]
                }
                
                // Set the final value
                const lastPart = pathParts[pathParts.length - 1]
                current[lastPart] = data.value
              }
              
              // Handle outputs data
              if (data.type === 'outputs' && data.outputs) {
                console.log('🔍 Outputs received:', JSON.stringify(data.outputs, null, 2))
                finalOutputs = { ...finalOutputs, ...data.outputs }
              }
              
              // Check if run is complete
              if (data.type === 'status' && data.status === 'completed') {
                console.log('✅ Generation completed')
                isCompleted = true
                break
              }
              
              // Check for errors
              if (data.type === 'error') {
                throw new Error(`Wordware stream error: ${JSON.stringify(data)}`)
              }
              
            } catch (parseError) {
              console.warn('⚠️ Failed to parse stream line, skipping:', parseError instanceof Error ? parseError.message : 'Unknown parse error')
              // Skip invalid JSON lines but continue processing
              continue
            }
          }
        }
        
        if (isCompleted) break
      }
    } finally {
      // Always close the reader
      reader.releaseLock()
    }
    
    console.log('🔍 Final outputs:', JSON.stringify(finalOutputs, null, 2))
    
    // Debug all image generation outputs
    console.log('🖼️ IMG1 debug:', JSON.stringify(finalOutputs.IMG1, null, 2))
    console.log('🖼️ IMG2 debug:', JSON.stringify(finalOutputs.IMG2, null, 2))
    console.log('🖼️ IMG3 debug:', JSON.stringify(finalOutputs.IMG3, null, 2))
    console.log('🖼️ Profile debug:', JSON.stringify(finalOutputs.Profile, null, 2))
    console.log('🖼️ Profile2 debug:', JSON.stringify(finalOutputs.Profile2, null, 2))
    
    // Enhanced image URL extraction with multiple fallback strategies
    const extractImageUrl = (imgObj: any, imgName: string): string => {
      if (!imgObj) {
        console.log(`🖼️ ${imgName} object is null/undefined`)
        return ''
      }
      
      console.log(`🖼️ ${imgName} object structure:`, JSON.stringify(imgObj, null, 2))
      
      // Try multiple possible paths for image URLs (updated for current API structure)
      const possiblePaths = [
        // Current API structure - ImageGenHelper Card
        imgObj?.['ImageGenHelper Card']?.['Image generation']?.image_url,
        imgObj?.['ImageGenHelper Card']?.['Image generation']?.output?.image_url,
        // Version 5.1 structure for IMG1, IMG2, IMG3
        imgObj?.['ImageGenHelper vertical']?.['Image generation']?.output?.image_url,
        imgObj?.['ImageGenHelper vertical']?.['Image generation']?.output?.type === 'image' ? imgObj?.['ImageGenHelper vertical']?.['Image generation']?.output?.image_url : null,
        // Version 5.1 structure for Profile
        imgObj?.['Image generation']?.output?.image_url,
        imgObj?.['Image generation']?.output?.type === 'image' ? imgObj?.['Image generation']?.output?.image_url : null,
        imgObj?.['Image generation']?.image_url,
        imgObj?.['Image generation']?.type === 'image' ? imgObj?.['Image generation']?.image_url : null,
        // Version 3.1 structure (fallback)
        imgObj?.['ImageGenHelper vertical']?.['Image generation']?.image_url,
        imgObj?.['ImageGenHelper vertical']?.['Image generation']?.output?.image_url,
        // Original structure (fallback)
        imgObj?.output?.image_url,
        imgObj?.image_url,
        imgObj?.url,
        // For nested structures
        imgObj?.generation?.output?.image_url,
        imgObj?.generation?.image_url,
        // Direct access if it's just a string
        typeof imgObj === 'string' ? imgObj : null
      ]
      
      console.log(`🖼️ ${imgName} trying paths:`, possiblePaths.map((path, i) => ({ index: i, value: path })))
      
      for (const path of possiblePaths) {
        if (typeof path === 'string' && path.trim() && path.startsWith('http')) {
          console.log(`🖼️ ${imgName} URL found via path:`, path)
          return path
        }
      }
      
      console.log(`🖼️ ${imgName} URL not found in any expected path`)
      return ''
    }
    
    // Try to find any field that might contain image URLs
    const allImageUrls: { path: string; url: string }[] = []
    const searchForImageUrls = (obj: any, path = ''): void => {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key
          if ((key === 'image_url' || key === 'url') && typeof value === 'string' && value.startsWith('http')) {
            allImageUrls.push({ path: currentPath, url: value })
          }
          if (typeof value === 'object') {
            searchForImageUrls(value, currentPath)
          }
        }
      }
    }
    searchForImageUrls(finalOutputs)
    console.log('🖼️ All image URLs found:', allImageUrls)
    
    // Extract image URLs using the enhanced function
    const image1_url = extractImageUrl(finalOutputs.IMG1, 'IMG1')
    const image2_url = extractImageUrl(finalOutputs.IMG2, 'IMG2') 
    const image3_url = extractImageUrl(finalOutputs.IMG3, 'IMG3')
    const profile_picture_url = extractImageUrl(finalOutputs.Profile, 'Profile') || extractImageUrl(finalOutputs.Profile2, 'Profile2')
    
    console.log('🖼️ Extracted image URLs:', { image1_url, image2_url, image3_url, profile_picture_url })
    
    // Extract each field as separate variables
    const extractedFields: ExtractedWordwareFields = {
      // Twitter data
      twitter_output: finalOutputs['Twitter scraper']?.output || '',
      
      // Core analysis
      core_symbol: finalOutputs.analysis?.core?.symbol || '',
      core_card_name: finalOutputs.analysis?.core?.card_name || '',
      core_interpretation: finalOutputs.analysis?.core?.interpretation || '',
      core_guidance: finalOutputs.analysis?.core?.guidance || '',
      
      // Obstacle analysis
      obstacle_symbol: finalOutputs.analysis?.obstacle?.symbol || '',
      obstacle_card_name: finalOutputs.analysis?.obstacle?.card_name || '',
      obstacle_interpretation: finalOutputs.analysis?.obstacle?.interpretation || '',
      
      // Trajectory analysis
      trajectory_symbol: finalOutputs.analysis?.trajectory?.symbol || '',
      trajectory_card_name: finalOutputs.analysis?.trajectory?.card_name || '',
      trajectory_interpretation: finalOutputs.analysis?.trajectory?.interpretation || '',
      
      // Image URLs - Using enhanced extraction with fallbacks
      image1_url: image1_url,
      image2_url: image2_url,
      image3_url: image3_url,
      
      // Image prompts
      image1_prompt: finalOutputs.IMG1?.finalPrompt || '',
      image2_prompt: finalOutputs.IMG2?.finalPrompt || '',
      image3_prompt: finalOutputs.IMG3?.finalPrompt || '',
      
      // Profile data - now includes profile picture generation in version 5.1
      profile_output: finalOutputs.Profile?.profilePrompt?.output || finalOutputs.Profile2?.finalPrompt || '',
      profile_picture_url: profile_picture_url,
    }

    console.log('✅ Extracted fields:', extractedFields)

    return { data: extractedFields, error: null }
    
  } catch (error) {
    console.error('❌ Wordware API error:', error)
    return { 
      data: null, 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }
  }
}

export const handleNewUsername = async ({ username, redirectPath }: { username: string; redirectPath?: string }) => {
  try {
    console.log(`[${username}] 🔍 Starting handleNewUsername...`)
    
    let user = await getUser({ username })
    
    // If user doesn't exist, create them first
    if (!user) {
      console.log(`[${username}] 🔍 User not found, creating minimal profile...`)
      
      // Create a minimal user profile without Twitter scraping
      const newUser = {
        username: username,
        lowercaseUsername: username.toLowerCase(),
        name: username, // Use username as display name
        profilePicture: '', // Empty for now
        description: '',
        location: '',
        url: '',
        fullProfile: {},
        followers: 0,
        profileScraped: true,
        wordwareStarted: false, // Will be set to true when we start generation
        wordwareStartedTime: new Date(),
        error: null,
      }
      
      try {
        await insertUser({ user: newUser })
        console.log(`[${username}] ✅ User created successfully`)
        user = await getUser({ username }) // Get the created user
      } catch (insertError) {
        console.error(`[${username}] ❌ Failed to insert user:`, insertError)
        throw new Error(`Failed to create user: ${insertError instanceof Error ? insertError.message : 'Unknown insert error'}`)
      }
    }
    
    // Check if tarot reading is needed (user exists but no analysis completed)
    if (user && !user.wordwareCompleted) {
      console.log(`[${username}] 🔮 User exists but tarot reading not completed, generating...`)
      
      // Update user to mark wordware as started
      await updateUser({
        user: {
          ...user,
          wordwareStarted: true,
          wordwareStartedTime: new Date(),
        },
      })
      
      // Call Wordware API to generate tarot reading and WAIT for it to complete
      try {
        console.log(`[${username}] 🔮 Generating tarot reading...`)
        const tarotResult = await callWordwareAPI({ twitterHandle: username })
        
        if (tarotResult.data && !tarotResult.error) {
          console.log(`[${username}] ✅ Tarot reading generated successfully`)
          
          // Update user with tarot data and profile picture from Wordware
          const updatedUser = await getUser({ username })
          if (updatedUser) {
            console.log(`[${username}] ✅ Tarot reading data received, updating user`)
            
            await updateUser({
              user: {
                ...updatedUser,
                profilePicture: tarotResult.data.profile_picture_url || updatedUser.profilePicture,
                analysis: {
                  ...((updatedUser.analysis as any) || {}),
                  ...tarotResult.data,
                },
                wordwareStarted: true,
                wordwareCompleted: true,
              },
            })
            console.log(`[${username}] ✅ User updated with tarot data`)
          }
        } else {
          console.log(`[${username}] ❌ Failed to generate tarot reading:`, tarotResult.error)
        }
      } catch (tarotError) {
        console.error(`[${username}] ❌ Failed to generate tarot reading:`, tarotError)
      }
    } else if (user && user.wordwareCompleted) {
      console.log(`[${username}] ✅ User exists and tarot reading already completed`)
    }
    
    console.log(`[${username}] ✅ Process completed successfully`)
    return { error: false, found: true }
    
  } catch (mainError) {
    console.error(`[${username}] ❌ Main error in handleNewUsername:`, mainError)
    return {
      data: null,
      error: mainError instanceof Error ? mainError.message : 'Unknown error occurred',
      found: false,
    }
  }
}

export const processScrapedUser = async ({ username }: { username: string }) => {
  let user = await getUser({ username })

  if (!user) {
    throw new Error(`User ${username} not found`)
  }

  // Just return the user - no tweet scraping needed
  console.log(`[${username}] ✅ Returning user data without tweet scraping`)
  return user
}

export const newsletterSignup = async ({ email }: { email: string }) => {
  try {
    await createLoopsContact(email)
    return { success: true }
  } catch (error) {
    return { success: false, error: error }
  }
}

export const unlockGenerationByEmail = async ({
  username,
  usernamePair,
  email,
  type = 'user',
}: {
  username: string
  usernamePair?: string
  email: string
  type?: 'pair' | 'user'
}) => {
  try {
    await createLoopsContact(email, 'Twitter Personality - PAYWALL')

    if (type === 'user') {
      await unlockUser({ username: username.replace('/', ''), unlockType: 'email' })
    }
    if (type === 'pair' && usernamePair) {
      await unlockPair({ username1: username, username2: usernamePair, unlockType: 'email' })
    }

    revalidatePath(username)
    return { success: true }
  } catch (error) {
    if (error instanceof Error && error.message.includes('Email already on list')) {
      await unlockUser({ username: username.replace('/', ''), unlockType: 'email' })
      revalidatePath(username)
      return { success: true }
    }

    if (error instanceof Error) {
      return { success: false, error: error.message }
    }
    return { success: false, error: 'An unknown error occurred' }
  }
}

export const handlePair = async ({ usernames, shouldRedirect }: { usernames: string[]; shouldRedirect?: boolean }) => {
  noStore()

  const existingPair = await getPair({ usernames })

  if (existingPair) {
    if (shouldRedirect) {
      redirect(`/${usernames[0]}/${usernames[1]}`)
    }
    return existingPair
  }

  const result = await insertPair({ usernames })

  if (result.length !== 1) {
    throw new Error('Expected to create exactly one pair, but got ' + result.length)
  }

  const newPair = result[0]

  if (shouldRedirect) {
    redirect(`/${usernames[0]}/${usernames[1]}`)
  }

  return newPair
}
