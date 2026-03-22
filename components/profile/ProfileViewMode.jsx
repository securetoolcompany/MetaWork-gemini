'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Store, Mail, MapPin, Phone, Globe, Music } from 'lucide-react';
import React from 'react';

export default function ProfileViewMode({ data }) {
  const countryFlags = {
    US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺',
    KR: '🇰🇷', JP: '🇯🇵', DE: '🇩🇪', FR: '🇫🇷',
  };

  if (!data) return null;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative w-full h-[400px]">
        {data.heroMedia?.url ? (
          <img src={data.heroMedia.url} alt="Hero" className="w-full h-full object-cover" />
        ) : (
          <div 
            className="w-full h-full bg-gradient-to-br" 
            style={{
              backgroundImage: `linear-gradient(135deg, ${data.accentColor || '#3b82f6'}40 0%, ${data.accentColor || '#3b82f6'}10 100%)`
            }} 
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Profile Picture */}
        {data.profilePicture?.url && (
          <div className="absolute bottom-8 left-8 z-10">
            <img 
              src={data.profilePicture.url} 
              alt="Profile" 
              className="w-32 h-32 rounded-full border-4 border-background object-cover shadow-xl" 
            />
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="max-w-7xl mx-auto pl-44">
            <div className="flex items-end gap-2 mb-2">
              <span className="text-4xl">{countryFlags[data.country] || '🌍'}</span>
              <h1 className="text-4xl md:text-5xl font-bold text-white">{data.displayName}</h1>
            </div>
            <p className="text-xl text-white/90 mb-4">{data.tagline}</p>
            <div className="flex flex-wrap gap-3">
              <Button 
                style={{ backgroundColor: data.accentColor || '#3b82f6' }}
                onClick={() => {
                  const aisleSlug = data.username; // Always use username for aisle URL
                  window.location.href = `/aisle/${aisleSlug}`;
                }}
              >
                <Store className="w-4 h-4 mr-2" />
                Visit My Aisle
              </Button>
              {data.tipJar?.enabled && (
                <Button 
                  variant="outline" 
                  className="bg-background/80 backdrop-blur"
                  onClick={() => {
                    // Open tip jar dialog or navigate to payment
                    alert(`Support ${data.displayName}!\n\n${data.tipJar.description || 'Show your support with a tip.'}\n\n(Tip jar integration coming soon)`);
                  }}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  {data.tipJar.title}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Biography / My Story Section */}
            {(data.bio || data.bioImage?.url || data.bioVideo?.url) && (
              <div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: data.accentColor || '#3b82f6' }}>
                  {data.bioSectionTitle || 'Biography / My Story'}
                </h2>
                
                {data.bioMode === 'video' && data.bioVideo?.url ? (
                  <div className="space-y-4">
                    {data.bioVideo.type === 'youtube' ? (
                      <iframe
                        src={data.bioVideo.url}
                        className="w-full aspect-video rounded-lg"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <video src={data.bioVideo.url} controls className="w-full rounded-lg" />
                    )}
                    {data.bio && (
                      <p className="text-foreground/90 whitespace-pre-wrap">{data.bio}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.bioImage?.url && (
                      <img src={data.bioImage.url} alt="Biography" className="w-full max-w-md rounded-lg" />
                    )}
                    {data.bio && (
                      <p className="text-foreground/90 whitespace-pre-wrap">{data.bio}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mission / Goal Statement */}
            {data.mission && (
              <div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: data.accentColor || '#3b82f6' }}>
                  {data.missionSectionTitle || 'Mission / Goal'}
                </h2>
                <p className="text-foreground/90 whitespace-pre-wrap">{data.mission}</p>
              </div>
            )}

            {/* Story Chapters */}
            {data.storySections && data.storySections.length > 0 && (
              <div className="space-y-8">
                <h2 className="text-2xl font-bold" style={{ color: data.accentColor || '#3b82f6' }}>
                  {data.chaptersSectionTitle || 'Story Chapters'}
                </h2>
                
                {data.storySections.map((section) => {
                  const sectionMedia = data[`storySection_${section.id}`] || [];
                  
                  return (
                    <div key={section.id} className="border-l-4 pl-6 py-2" style={{ borderColor: data.accentColor || '#3b82f6' }}>
                      <h3 className="text-xl font-semibold mb-2">{section.title}</h3>
                      {section.description && (
                        <p className="text-muted-foreground mb-4 whitespace-pre-wrap">{section.description}</p>
                      )}
                      
                      {sectionMedia.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {sectionMedia.map((media) => (
                            <div key={media.id} className="space-y-2">
                              {media.type === 'image' && media.url && (
                                <img src={media.url} alt={media.caption} className="w-full aspect-square object-cover rounded-lg" />
                              )}
                              {media.type === 'video' && media.url && (
                                <>
                                  {media.urlType === 'youtube' ? (
                                    <iframe
                                      src={media.url}
                                      className="w-full aspect-square rounded-lg"
                                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                      allowFullScreen
                                    />
                                  ) : (
                                    <video src={media.url} controls className="w-full aspect-square object-cover rounded-lg" />
                                  )}
                                </>
                              )}
                              {media.type === 'audio' && media.url && (
                                <div className="w-full aspect-square bg-muted rounded-lg flex flex-col items-center justify-center p-4">
                                  <Music className="w-12 h-12 text-muted-foreground mb-3" />
                                  <audio src={media.url} controls className="w-full" />
                                </div>
                              )}
                              {media.caption && (
                                <p className="text-sm text-muted-foreground">{media.caption}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Information */}
            {(data.location || data.email || data.phone || data.website) && (
              <Card>
                <div className="p-6">
                  <h3 className="font-semibold mb-4">Contact</h3>
                  <div className="space-y-3">
                    {data.location && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span>{data.location}</span>
                      </div>
                    )}
                    {data.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <a href={`mailto:${data.email}`} className="hover:underline">{data.email}</a>
                      </div>
                    )}
                    {data.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <a href={`tel:${data.phone}`} className="hover:underline">{data.phone}</a>
                      </div>
                    )}
                    {data.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <a href={data.website} target="_blank" rel="noopener noreferrer" className="hover:underline truncate">
                          {data.website.replace(/^https?:\/\//, '')}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {/* Tip Jar */}
            {data.tipJar?.enabled && (
              <Card>
                <div className="p-6">
                  <h3 className="font-semibold flex items-center gap-2 mb-4">
                    <Heart className="w-4 h-4" style={{ color: data.accentColor || '#3b82f6' }} />
                    {data.tipJar.title}
                  </h3>
                  {data.tipJar.description && (
                    <p className="text-sm text-muted-foreground mb-4">{data.tipJar.description}</p>
                  )}
                  <Button 
                    className="w-full" 
                    style={{ backgroundColor: data.accentColor || '#3b82f6' }}
                    onClick={() => {
                      alert(`Support ${data.displayName}!\n\n${data.tipJar.description || 'Show your support with a tip.'}\n\n(Tip jar integration coming soon)`);
                    }}
                  >
                    Support
                  </Button>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
