import { Suspense } from 'react'
import Link from 'next/link'
import { PiBrain, PiGithubLogo, PiXLogo } from 'react-icons/pi'

// import Head from 'next/head'  // Import Head component for managing <head> elements

import Quote from '@/app/quote'
import NewUsernameForm from '@/components/new-username-form'
import PHButton from '@/components/ph-button'
import { Button } from '@/components/ui/button'

// import TopList from './top-list'

export const maxDuration = 181

// follow tag
export async function generateMetadata({ searchParams }: { searchParams: { ref?: string; u?: string } }) {
  // Allow following only for specific query parameters
  const allowedRefs = ['blog.wordware.ai']
  const isAllowedRef = searchParams.ref && allowedRefs.includes(searchParams.ref)
  const isRobotsQuery = searchParams.u === 'robots.txt'
  // if robots.txt or blog.wordware.ai, allow following
  if (isAllowedRef || isRobotsQuery) {
    return {
      robots: {
        index: true,
        follow: true,
      },
    }
  }

  // For all other cases, default to no follow
  return {
    robots: {
      index: false,
      follow: false,
    },
  }
}

const Page = () => {
  return (
    <>
      {/* <Head>
        <meta name="google-site-verification" content="voWl21V26444ofs1ojAqhH1UdOTEWBvJQHp9jADLDQU" />
    </Head> */}
      <section className="">
        <div className="flex flex-col md:flex-row">
          <div className="relative flex min-h-[80svh] flex-col justify-center bg-[#F9FAFB] p-8 sm:p-12 md:w-1/2 md:p-16 lg:p-24">
            <div className="grow" />

            <div>
              <div>
                <h1 className="mb-8 text-4xl md:text-5xl 2xl:text-5xl">
                  🔮 Discover your <br />
                  <span
                    className="bg-clip-text text-transparent"
                    style={{ backgroundColor: '#CB9F9F' }}>
                    founder fate
                  </span>
                </h1>

                <div className="mb-8 flex w-full flex-col pt-2">
                  <div className="flex w-full items-center">
                    <Suspense>
                      <NewUsernameForm />
                    </Suspense>
                  </div>
                </div>
              </div>

              <div className="mb-8 pt-8 text-base">
                🧙‍♂️ These are AI Tarot Agents built with{' '}
                <a
                  className="font-medium underline-offset-4 hover:underline"
                  target="_blank"
                  href="https://wordware.ai">
                  Wordware
                </a>
                <br />
                They will:
                <ul className="mt-2 list-disc space-y-1 pl-8">
                  <li>Find your public Twitter presence</li>
                  <li>Read your tweets and (if available) your website</li>
                  <li>Use Large Language Models — like the ones behind ChatGPT — to interpret your founder energy</li>
                  <li>Then, they&apos;ll reveal 3 tarot cards: your present, your challenge, and your future</li>
                </ul>
                <p className="mt-4">
                  Each reading is poetic, symbolic, and eerily accurate
                </p>
                <p className="mt-2">
                  You&apos;ll receive a mystical interpretation — ready to screenshot, share, or contemplate alone in the dark.
                </p>
              </div>
            </div>
            <div className="grow" />

            <div className="bottom-6 space-y-3 border-t">
              <div className="flex flex-col gap-2">
                <p className="mt-8 text-sm">
                  <span
                    className="bg-clip-text font-bold text-transparent"
                    style={{ backgroundColor: '#CB9F9F' }}>
                    support the Wordware launch!
                  </span>
                </p>
                <div className="flex flex-wrap gap-2">
                  <PHButton />
                  <Button
                    variant={'outline'}
                    asChild>
                    <a
                      href="https://github.com/wordware-ai/twitter"
                      target="_blank"
                      className="flex-center gap-2">
                      <PiGithubLogo />
                      GitHub Repo
                    </a>
                  </Button>
                  <Button
                    asChild
                    variant={'outline'}>
                    <Link
                      href="/open"
                      className="flex items-center gap-2">
                      <PiBrain />
                      Stats
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex h-full w-full items-center justify-center bg-[#F6F0F0] md:h-auto md:w-1/2">
            <div className="hidden md:block">
              <Quote />
            </div>
          </div>
        </div>
        {/* <TopList /> */}
      </section>
    </>
  )
}

export default Page
