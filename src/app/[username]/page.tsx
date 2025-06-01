import { notFound, redirect } from 'next/navigation'
import { Metadata } from 'next/types'
import Image from 'next/image'

import { siteMetadata } from '@/app/metadata'
import { getUser } from '@/drizzle/queries'

import { ProfileHighlight } from '../../components/analysis/profile-highlight'
// import PHPopup from './ph-popup'
import ResultComponent from '../../components/analysis/result-component'
import Topbar from '../../components/top-bar'
import ProfileHeader from '../../components/analysis/profile-header'

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
      
      {/* Header Section with Profile Picture - Now reactive to updates */}
      <ProfileHeader user={data} />

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
