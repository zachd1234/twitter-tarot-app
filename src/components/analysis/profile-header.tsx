'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { SelectUser } from '@/drizzle/schema'

const ProfileHeader = ({ user }: { user: SelectUser }) => {
  const [currentUser, setCurrentUser] = useState<SelectUser>(user)

  // Listen for real-time updates to user data
  useEffect(() => {
    if (!user.username) return

    console.log('🖼️ ProfileHeader: Setting up real-time updates for', user.username)

    const eventSource = new EventSource(`/api/user/${user.username}/stream`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        
        if (data.type === 'update' && data.user) {
          console.log('🖼️ ProfileHeader: Received user update', {
            username: data.user.username,
            hasProfilePicture: !!data.user.profilePicture,
            profilePictureUrl: data.user.profilePicture
          })
          
          // Update the current user with all fields including profilePicture
          setCurrentUser(prev => ({
            ...prev,
            ...data.user
          }))
        }
      } catch (error) {
        console.error('🖼️ ProfileHeader: SSE message parse error:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('🖼️ ProfileHeader: SSE error:', error)
      eventSource.close()
    }

    return () => {
      console.log('🖼️ ProfileHeader: Cleaning up SSE connection')
      eventSource.close()
    }
  }, [user.username])

  return (
    <div className="flex-center flex-col gap-8">
      {/* Profile Picture - Large and Centered */}
      <div className="flex-center">
        {currentUser.profilePicture ? (
          <Image
            src={currentUser.profilePicture}
            alt={`Profile picture of ${currentUser.name}`}
            className="h-32 w-32 rounded-full border-4 border-white shadow-lg object-cover"
            width={128}
            height={128}
            priority
            key={currentUser.profilePicture} // Force re-render when URL changes
          />
        ) : (
          <div className="h-32 w-32 rounded-full border-4 border-white shadow-lg bg-gray-200 flex items-center justify-center">
            <span className="text-gray-500 text-lg">
              {currentUser.name?.charAt(0) || currentUser.username.charAt(0)}
            </span>
          </div>
        )}
      </div>
      
      {/* User Info */}
      <div className="flex-center flex-col gap-2 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{currentUser.name}</h1>
        <span className="text-lg text-gray-500">@{currentUser.username}</span>
        {currentUser.location && (
          <div className="text-gray-500">{currentUser.location}</div>
        )}
      </div>
      
      {/* AI Message */}
      <div className="text-center text-xl font-light">
        The AI has spoken. Here&apos;s what it sees in your journey right now.
      </div>
    </div>
  )
}

export default ProfileHeader 