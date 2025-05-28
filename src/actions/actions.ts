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
    prompt: {
      code: string
      logs: string
      error: string
      output: string
    }
    'Image generation': {
      output: {
        type: 'image'
        image_url: string
      }
    }
  }
  IMG2: {
    prompt: {
      code: string
      logs: string
      error: string
      output: string
    }
    'Image generation': {
      output: {
        type: 'image'
        image_url: string
      }
    }
  }
  IMG3: {
    prompt: {
      code: string
      logs: string
      error: string
      output: string
    }
    'Image generation': {
      output: {
        type: 'image'
        image_url: string
      }
    }
  }
  Profile: {
    new_code_block: {
      code: string
      logs: string
      error: string
      output: string
    }
  }
  ProfilePicture: {
    output: {
      type: 'image'
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
            version: '1.0',
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
    
    // Debug ProfilePicture specifically
    console.log('🖼️ ProfilePicture debug:', JSON.stringify(finalOutputs.ProfilePicture, null, 2))
    
    // Debug all image generation outputs
    console.log('🖼️ IMG1 debug:', JSON.stringify(finalOutputs.IMG1, null, 2))
    console.log('🖼️ IMG2 debug:', JSON.stringify(finalOutputs.IMG2, null, 2))
    console.log('🖼️ IMG3 debug:', JSON.stringify(finalOutputs.IMG3, null, 2))
    
    // Check if ProfilePicture might be nested differently
    console.log('🖼️ All keys in finalOutputs:', Object.keys(finalOutputs))
    
    // Try to find any field that might contain profile picture
    const allImageUrls: { path: string; url: string }[] = []
    const searchForImageUrls = (obj: any, path = ''): void => {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key
          if (key === 'image_url' && typeof value === 'string' && value) {
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
    
    // Try alternative extraction paths for ProfilePicture
    const profilePictureUrl = 
      finalOutputs.ProfilePicture?.output?.image_url ||
      finalOutputs.ProfilePicture?.['Image generation']?.output?.image_url ||
      finalOutputs.ProfilePicture?.['Image generation']?.image_url ||
      finalOutputs['ProfilePicture']?.output?.image_url ||
      // Try to find any image URL that might be the profile picture
      (allImageUrls.length > 3 ? allImageUrls[3]?.url : '') ||
      ''
    
    console.log('🖼️ Extracted profile picture URL:', profilePictureUrl)
    console.log('🖼️ ProfilePicture raw structure:', finalOutputs.ProfilePicture)
    
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
      
      // Image URLs - Updated based on the correct structure
      image1_url: finalOutputs.IMG1?.['Image generation']?.output?.image_url || '',
      image2_url: finalOutputs.IMG2?.['Image generation']?.output?.image_url || '',
      image3_url: finalOutputs.IMG3?.['Image generation']?.output?.image_url || '',
      
      // Image prompts
      image1_prompt: finalOutputs.IMG1?.prompt?.output || '',
      image2_prompt: finalOutputs.IMG2?.prompt?.output || '',
      image3_prompt: finalOutputs.IMG3?.prompt?.output || '',
      
      // Profile data
      profile_output: finalOutputs.Profile?.new_code_block?.output || '',
      profile_picture_url: profilePictureUrl,
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
    
    const user = await getUser({ username })
    if (user) {
      console.log(`[${username}] ✅ User already exists, redirecting...`)
      if (redirectPath) {
        redirect(redirectPath)
      } else {
        return { error: false, found: true }
      }
    }

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
      error: null,
    }
    
    try {
      await insertUser({ user: newUser })
      console.log(`[${username}] ✅ User created successfully`)
    } catch (insertError) {
      console.error(`[${username}] ❌ Failed to insert user:`, insertError)
      throw new Error(`Failed to create user: ${insertError instanceof Error ? insertError.message : 'Unknown insert error'}`)
    }
    
    // Call Wordware API to generate tarot reading
    try {
      console.log(`[${username}] 🔮 Generating tarot reading...`)
      const tarotResult = await callWordwareAPI({ twitterHandle: username })
      
      if (tarotResult.data && !tarotResult.error) {
        console.log(`[${username}] ✅ Tarot reading generated successfully`)
        
        // Update user with tarot data and profile picture
        const updatedUser = await getUser({ username })
        if (updatedUser) {
          console.log(`[${username}] 🖼️ Profile picture URL from API:`, tarotResult.data.profile_picture_url)
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
          console.log(`[${username}] ✅ User updated with tarot data and profile picture`)
        }
      } else {
        console.log(`[${username}] ⚠️ Tarot reading failed:`, tarotResult.error)
        // Continue with redirect even if tarot generation fails
      }
    } catch (tarotError) {
      console.error(`[${username}] ❌ Tarot API error:`, tarotError)
      // Continue with redirect even if tarot generation fails
    }
    
    console.log(`[${username}] ✅ Process completed successfully`)
    if (redirectPath) {
      redirect(redirectPath)
    }
    return { error: false, found: true }
    
  } catch (mainError) {
    // Don't catch NEXT_REDIRECT errors - let them propagate to handle redirects
    if (mainError instanceof Error && mainError.message === 'NEXT_REDIRECT') {
      throw mainError
    }
    
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

  // If tweets are already scraped, return them
  if (user.tweetScrapeCompleted) {
    return user.tweets
  }

  if (!user.tweetScrapeStarted || (!user.tweetScrapeCompleted && Date.now() - user.createdAt.getTime() > 3 * 60 * 1000)) {
    user = {
      ...user,
      tweetScrapeStarted: true,
      tweetScrapeStartedTime: new Date(),
    }
    await updateUser({ user })
    let tweets
    let error
    const twitterUserID = (user.fullProfile as { twitterUserID?: string })?.twitterUserID ?? undefined

    try {
      const res = await scrapeTweets({ username, twitterUserID: twitterUserID })
      tweets = res.data
      error = res.error
      if (!tweets) throw new Error('No tweets found')
    } catch (e) {
      error = e
      console.warn(`[${username}] ⚠️ All 3 attemtps failed. Trying again...`, e)
      try {
        const res = await scrapeTweets({ username, twitterUserID: twitterUserID })
        tweets = res.data
        error = res.error
        console.warn(`[${username}] ⚠️ All 6 attemtps failed.`, e)
        if (!tweets) throw new Error('No tweets found')
      } catch (e) {
        console.warn(`[${username}] ⚠️ Yeah it's fucked:`, e)
        throw e
      }
    }

    if (tweets && !error) {
      user = {
        ...user,
        tweets: tweets,
        tweetScrapeCompleted: true,
      }
      await updateUser({ user })
      return tweets
    }
    if (error) {
      user = {
        ...user,
        error: JSON.stringify(error),
      }

      await updateUser({ user })
    }
  }

  // Add your processing logic here
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
