'use client'

import React from 'react'
import Image from 'next/image'

interface TarotCardProps {
  symbol: string
  cardName: string
  interpretation: string
  imageUrl: string
  title: string
}

const TarotCard: React.FC<TarotCardProps> = ({ 
  symbol, 
  cardName, 
  interpretation, 
  imageUrl, 
  title
}) => {
  return (
    <div className="flex h-full flex-col items-center justify-between space-y-6 rounded-xl bg-white p-8 shadow-lg transition-all duration-200 hover:shadow-xl">
      {/* Header */}
      <div className="flex flex-col items-center space-y-4">
        <h3 className="text-2xl font-semibold text-gray-800">{title}</h3>
        
        {/* Tarot Card Image */}
        <div className="relative h-72 w-52 overflow-hidden rounded-lg shadow-md">
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
        
        {/* Card Name and Symbol */}
        <div className="flex flex-col items-center space-y-2">
          <h4 className="text-xl font-medium text-gray-700">{cardName}</h4>
          <div className="text-3xl">{symbol}</div>
        </div>
      </div>
      
      {/* Content */}
      <div className="flex-1 flex flex-col justify-center text-center">
        <div className="text-gray-600">
          <p className="leading-relaxed">{interpretation}</p>
        </div>
      </div>
    </div>
  )
}

export default TarotCard 