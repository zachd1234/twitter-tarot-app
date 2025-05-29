'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import ReactCardFlip from 'react-card-flip'

interface FlipTarotCardProps {
  title: string
  symbol: string
  cardName: string
  interpretation: string
  imageUrl: string
}

const FlipTarotCard: React.FC<FlipTarotCardProps> = ({ 
  title,
  symbol, 
  cardName, 
  interpretation, 
  imageUrl
}) => {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleClick = () => {
    setIsFlipped(!isFlipped)
  }

  return (
    <div className="h-[448px] w-full max-w-sm mx-auto">
      <ReactCardFlip 
        isFlipped={isFlipped} 
        flipDirection="vertical"
        flipSpeedFrontToBack={0.6}
        flipSpeedBackToFront={0.6}
      >
        {/* Front Face - Image and Card Name */}
        <div 
          key="front"
          className="h-[448px] w-full cursor-pointer rounded-xl bg-white p-4 shadow-lg transition-all duration-200 hover:shadow-xl flex flex-col relative overflow-hidden border border-gray-200"
          onClick={handleClick}
        >
          {/* Card Title at Top */}
          <div className="text-center mb-3">
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{title}</h3>
          </div>
          
          {/* Tarot Card Image */}
          <div className="flex-1 relative overflow-hidden rounded-lg mb-4">
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={`${cardName} tarot card`}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-100 to-blue-100 text-gray-500">
                <span className="text-6xl">{symbol}</span>
              </div>
            )}
          </div>
          
          {/* Card Name at Bottom */}
          <div className="text-center pb-2">
            <h4 className="text-xl font-semibold text-gray-800">{cardName}</h4>
          </div>
          
          {/* Tap hint */}
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-xs text-gray-400">
            Tap to read
          </div>
        </div>

        {/* Back Face - Interpretation Only */}
        <div 
          key="back"
          className="h-[448px] w-full cursor-pointer rounded-xl bg-gradient-to-br from-purple-50 to-blue-50 shadow-lg transition-all duration-200 hover:shadow-xl flex flex-col relative border border-purple-100 overflow-hidden"
          onClick={handleClick}
        >
          {/* Card Title at Top */}
          <div className="text-center p-4 border-b border-purple-200/50">
            <h3 className="text-lg font-bold text-gray-800 uppercase tracking-wide">{title}</h3>
          </div>
          
          {/* Interpretation Text with Scrolling */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="h-full flex items-start justify-center">
              <p className="text-gray-700 leading-relaxed text-base font-medium text-left max-w-none">{interpretation}</p>
            </div>
          </div>
        </div>
      </ReactCardFlip>
    </div>
  )
}

export default FlipTarotCard 