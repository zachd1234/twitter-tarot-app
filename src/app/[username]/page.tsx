import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next/types'
import Image from 'next/image'

import { siteMetadata } from '@/app/metadata'
import { getUser } from '@/drizzle/queries'

import { ProfileHighlight } from '../../components/analysis/profile-highlight'
// import PHPopup from './ph-popup'
import ResultComponent from '../../components/analysis/result-component'
import Topbar from '../../components/top-bar'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

// LEE Case 2
const Page = async ({ params }: { params: { username: string } }) => {
  const data = await getUser({ username: params.username })

  if (!data) {
    return redirect(`/?u=${params.username}`)
  }

  return (
    <div className="flex-center relative min-h-screen w-full flex-col gap-12 bg-[#F9FAFB] px-4 py-28 sm:px-12 md:px-28 md:pt-24">
      <Topbar />
      
      {/* Header Section with Profile Picture */}
      <div className="flex-center flex-col gap-8">
        {/* Profile Picture - Large and Centered */}
        <div className="flex-center">
          {data.profilePicture ? (
            <Image
              src={data.profilePicture}
              alt={`Profile picture of ${data.name}`}
              className="h-32 w-32 rounded-full border-4 border-white shadow-lg object-cover"
              width={128}
              height={128}
              priority
            />
          ) : (
            <div className="h-32 w-32 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
              <span className="text-gray-500 text-lg">
                {data.name?.charAt(0) || data.username.charAt(0)}
              </span>
            </div>
          )}
        </div>
        
        {/* User Info */}
        <div className="flex-center flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold text-gray-900">{data.name}</h1>
          <span className="text-lg text-gray-500">@{data.username}</span>
          {data.location && (
            <div className="text-gray-500">{data.location}</div>
          )}
        </div>
        
        {/* AI Message */}
        <div className="text-center text-xl font-light">
          The AI has spoken. Here&apos;s what it sees in your journey right now.
        </div>
      </div>

      <ResultComponent user={data} />
    </div>
  )
}

export default Page

export async function generateMetadata({ params, searchParams }: { params: { username?: string }; searchParams: { section?: string } }) {
  if (!params.username) return {
    title: 'Twitter Personality Analysis by AI Agent',
    description: 'AI-powered personality analysis from Twitter profiles.',
  }
  
  const user = await getUser({ username: params.username })

  // If user is not found, return basic metadata instead of calling notFound()
  if (user == null) {
    return {
      title: `${params.username}'s Twitter Personality Analysis by AI Agent`,
      description: `Check out ${params.username}'s analysis.`,
      robots: {
        index: false,
        follow: false,
      },
    }
  }
  
  const imageParams = new URLSearchParams()

  const name = user?.name || ''
  const username = user?.username || ''
  const picture = user?.profilePicture || ''
  const section = searchParams.section || 'about'
  const content = (user.analysis as any)?.[section]
  const emojis = ((user.analysis as any)?.emojis || '').trim()

  imageParams.set('name', name)
  imageParams.set('username', username)
  imageParams.set('picture', picture)
  imageParams.set('content', typeof content === 'string' ? content : JSON.stringify(content))
  imageParams.set('emojis', emojis)
  imageParams.set('section', section)

  const image = {
    alt: 'Banner',
    url: `/api/og?${imageParams.toString()}`,
    width: 1200,
    height: 630,
  }

  return {
    title: `${name}`,
    description: `Check out ${name}'s analysis.`,
    openGraph: {
      url: section ? `/${username}?section=${section}` : `/${username}`,
      images: image,
    },
    twitter: {
      images: image,
      // dynamic twitter description
      description: siteMetadata.twitter(username),
    },
    // prevent follow tag on other pages
    robots: {
      index: false,
      follow: false,
    },
  } satisfies Metadata
}
