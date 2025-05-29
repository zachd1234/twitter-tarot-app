'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { PiSpinner } from 'react-icons/pi'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cleanUsername } from '@/lib/utils'

const NewUsernameForm = () => {
  const searchParams = useSearchParams()
  const [username, setUsername] = useState(searchParams.get('u') || searchParams.get('username') || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  console.log('🔧 NewUsernameForm component loaded')
  console.log('🔧 Initial username value:', username)
  console.log('🔧 Username length:', username.length)
  console.log('🔧 Is submitting:', isSubmitting)
  console.log('🔧 Button should be disabled:', isSubmitting || !username || username.length < 2)

  const handleSubmit = async () => {
    console.log('🚀 handleSubmit called with username:', username)
    if (!username || username.length < 2) {
      setError('Username must be at least 2 characters')
      return
    }
    
    setError('')
    setIsSubmitting(true)
    
    console.log('🚀 Submitting with username:', username)
    
    try {
      const cleanedUsername = cleanUsername(username)
      console.log('🧹 Cleaned username:', cleanedUsername)
      
      console.log('📡 Creating user...')
      // First, create the user to ensure they exist before redirecting
      const createResponse = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanedUsername })
      })
      
      console.log('📡 Create response status:', createResponse.status)
      
      if (!createResponse.ok) {
        const errorData = await createResponse.text()
        console.error('❌ Failed to create user:', errorData)
        window.location.href = 'https://tally.so/r/3lRoOp'
        return
      }
      
      const createResult = await createResponse.json()
      console.log('✅ User created/exists:', createResult)
      
      // Now redirect immediately - user is guaranteed to exist
      console.log('🔄 Redirecting to:', `/${cleanedUsername}`)
      window.location.href = `/${cleanedUsername}`
      
      // Start the tarot generation in the background
      fetch('/api/generate-reading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanedUsername })
      }).catch(error => {
        console.error('❌ Background API error:', error)
      })
      
    } catch (error) {
      console.error('❌ Error in form submission:', error)
      setError('Something went wrong. Please try again.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Button
        asChild
        className="hidden max-w-[220px]">
        <a
          href="https://tally.so/r/3lRoOp"
          target="_blank">
          Sign up for the Waitlist
        </a>
      </Button>
      
      <div className="w-full max-w-sm space-y-8">
        <div>
          <div className="flex items-center">
            <Input
              disabled={isSubmitting}
              className="w-full rounded-l-sm rounded-r-none border-black"
              placeholder="@yourhandle"
              value={username}
              onChange={(e) => {
                console.log('📝 Input changed to:', e.target.value)
                setUsername(e.target.value)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <Button
              disabled={isSubmitting || !username || username.length < 2}
              type="button"
              onClick={handleSubmit}
              className="flex-center gap-2 rounded-l-none rounded-r-sm">
              🔮 Read My Cards
            </Button>
          </div>
          
          {error && (
            <p className="mt-2 text-sm text-red-600">{error}</p>
          )}
          
          <p className="mt-2 text-xs">
            by clicking, you summon the cards and agree to our{' '}
            <a
              className="underline-offset-4 hover:underline"
              href="/terms">
              terms
            </a>
          </p>
        </div>
      </div>
      
      {/* Display loading spinner when submitting */}
      {isSubmitting && (
        <div className="flex items-center gap-2 text-sm">
          <PiSpinner className="animate-spin" />
          Summoning the mystical forces...
        </div>
      )}
    </div>
  )
}

export default NewUsernameForm
