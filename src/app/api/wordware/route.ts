import { getUser, updateUser } from '@/drizzle/queries'
import { TweetType, TwitterAnalysis } from '@/types'

/**
 * Maximum duration for the API route execution (in seconds)
 */
export const maxDuration = 300
export const dynamic = 'force-dynamic'
// export const runtime = 'edge'

export async function POST(request: Request) {
  // Extract username from the request body
  const { username, full } = await request.json()

  // Fetch user data and check if Wordware has already been started
  const user = await getUser({ username })

  if (!user) {
    throw Error(`User not found: ${username}`)
  }

  if (!full) {
    if (user.wordwareCompleted || (user.wordwareStarted && Date.now() - user.createdAt.getTime() < 3 * 60 * 1000)) {
      return Response.json({ error: 'Wordware already started' })
    }
  }

  if (full) {
    if (user.paidWordwareCompleted || (user.paidWordwareStarted && Date.now() - user.createdAt.getTime() < 3 * 60 * 1000)) {
      return Response.json({ error: 'Wordware already started' })
    }
  }

  function formatTweet(tweet: TweetType) {
    // console.log('Formatting', tweet)
    const isRetweet = tweet.isRetweet ? 'RT ' : ''
    const author = tweet.author?.userName ?? username
    const createdAt = tweet.createdAt
    const text = tweet.text ?? '' // Ensure text is not undefined
    const formattedText = text
      .split('\n')
      .map((line) => `${line}`)
      .join(`\n> `)
    return `**${isRetweet}@${author} - ${createdAt}**

> ${formattedText}

*retweets: ${tweet.retweetCount ?? 0}, replies: ${tweet.replyCount ?? 0}, likes: ${tweet.likeCount ?? 0}, quotes: ${tweet.quoteCount ?? 0}, views: ${tweet.viewCount ?? 0}*`
  }

  const tweets = (user.tweets as TweetType[]) || []

  const tweetsMarkdown = tweets.length > 0 ? tweets.map(formatTweet).join('\n---\n\n') : 'No tweets available'

  const promptID = full ? process.env.WORDWARE_FULL_PROMPT_ID : process.env.WORDWARE_ROAST_PROMPT_ID

  // Make a request to the Wordware API

  console.log(
    'body: ',
    JSON.stringify({
      tweets: tweetsMarkdown,
      profilePicture: {
        type: 'image',
        image_url: user.profilePicture,
      },
      profileInfo: JSON.stringify(user.fullProfile),
    }),
  )
  const runResponse = await fetch(`https://app.wordware.ai/api/released-app/${promptID}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.WORDWARE_API_KEY}`,
    },
    body: JSON.stringify({
      inputs: {
        tweets: tweetsMarkdown,
        profilePicture: {
          type: 'image',
          image_url: user.profilePicture,
        },
        profileInfo: JSON.stringify(user.fullProfile),
      },
      version: '^1.0',
    }),
  })

  const reader = runResponse.body?.getReader()

  if (!reader || !runResponse.ok) {
    // console.error('No reader')

    return Response.json({ error: 'No reader' }, { status: 400 })
  }

  // Update user to indicate Wordware has started
  await updateUser({
    user: {
      ...user,
      wordwareStarted: true,
      wordwareStartedTime: new Date(),
    },
  })

  // Set up decoder and buffer for processing the stream
  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  let buffer: string[] = []
  let finalOutput = false
  const existingAnalysis = user?.analysis as TwitterAnalysis

  // Create a readable stream to process the response
  const stream = new ReadableStream({
    async start(controller) {
      //Edge runtime requires to send a first chunk within the first 30 seconds. We send an empty string to keep the connection alive.
      controller.enqueue(encoder.encode(''))

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) {
            controller.close()
            return
          }

          const chunk = decoder.decode(value)
          // console.log('🟣 | file: route.ts:80 | start | chunk:', chunk)

          // Process the chunk character by character
          for (let i = 0, len = chunk.length; i < len; ++i) {
            const isChunkSeparator = chunk[i] === '\n'

            if (!isChunkSeparator) {
              buffer.push(chunk[i])
              continue
            }

            const line = buffer.join('').trimEnd()

            // Parse the JSON content of each line
            const content = JSON.parse(line)
            const value = content.value

            // Handle different types of messages in the stream
            if (value.type === 'generation') {
              if (value.state === 'start') {
                if (value.label === 'output') {
                  finalOutput = true
                }
                // console.log('\nNEW GENERATION -', value.label)
              } else {
                if (value.label === 'output') {
                  finalOutput = false
                }
                // console.log('\nEND GENERATION -', value.label)
              }
            } else if (value.type === 'chunk') {
              if (finalOutput) {
                controller.enqueue(encoder.encode(value.value ?? ''))
              }
            } else if (value.type === 'outputs') {
              console.log(`[${user.username}]  Wordware:`, value.values.output, '. Now parsing')
              try {
                const statusObject = full
                  ? {
                      paidWordwareStarted: true,
                      paidWordwareCompleted: true,
                    }
                  : { wordwareStarted: true, wordwareCompleted: true }
                // Update user with the analysis from Wordware
                await updateUser({
                  user: {
                    ...user,
                    ...statusObject,
                    analysis: {
                      ...existingAnalysis,
                      ...value.values.output,
                    },
                  },
                })
                // console.log('Analysis saved to database')
              } catch (error) {
                console.error('Error parsing or saving output:', error)

                const statusObject = full
                  ? {
                      paidWordwareStarted: false,
                      paidWordwareCompleted: false,
                    }
                  : { wordwareStarted: false, wordwareCompleted: false }
                await updateUser({
                  user: {
                    ...user,
                    ...statusObject,
                  },
                })
              }
            }

            // Reset buffer for the next line
            buffer = []
          }
        }
      } finally {
        // Ensure the reader is released when done
        reader.releaseLock()
      }
    },
  })

  // Return the stream as the response
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain' },
  })
}
