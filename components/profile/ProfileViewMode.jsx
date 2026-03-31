'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Store, Mail, MapPin, Phone, Globe, Music } from 'lucide-react';
import { toast } from 'sonner';
import { ShareButton } from '@/components/ui/share-button';
import React from 'react';

export default function ProfileViewMode({ data }) {
  const countryFlags = {
    US: '🇺🇸', GB: '🇬🇧', CA: '🇨🇦', AU: '🇦🇺',
    KR: '🇰🇷', JP: '🇯🇵', DE: '🇩🇪', FR: '🇫🇷',
  };

  if (!data) return null;

  return (
    <div className="min-h-screen">
      {/* Hero Section: Height is dynamic on mobile, fixed on desktop */}
      <div className="relative w-full min-h-[350px] md:h-[450px] flex flex-col justify-end">
        {data.heroMedia?.url ? (
          <img src={data.heroMedia.url} alt="Hero" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div 
            className="absolute inset-0 w-full h-full bg-gradient-to-br" 
            style={{
              backgroundImage: `linear-gradient(135deg, ${data.accentColor || '#3b82f6'}40 0%, ${data.accentColor || '#3b82f6'}10 100%)`
            }} 
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        
        {/* Profile Content Container */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 pb-8 md:pb-12">
          <div className="flex flex-col md:flex-row items-center md:items-end gap-6">
            
            {/* Profile Picture: Centered on mobile */}
            {data.profilePicture?.url && (
              <div className="shrink-0">
                <img 
                  src={data.profilePicture.url} 
                  alt="Profile" 
                  className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background object-cover shadow-xl" 
                />
              </div>
            )}
            
            {/* Text & Actions: Centered on mobile */}
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                  <span className="text-3xl md:text-4xl">{countryFlags[data.country] || '🌍'}</span>
                  <h1 className="text-3xl md:text-5xl font-bold text-white leading-tight">
                    {data.displayName}
                  </h1>
                </div>
                <p className="text-lg md:text-xl text-white/90 font-medium max-w-2xl">
                  {data.tagline}
                </p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <Button 
                  style={{ backgroundColor: data.accentColor || '#3b82f6', color: '#ffffff' }}
                  className="w-full sm:w-auto border-2 border-transparent shadow-lg"
                  onClick={() => window.location.href = `/aisle/${data.username}`}
                >
                  <Store className="w-4 h-4 mr-2" />
                  Visit My Aisle
                </Button>
                
                {data.tipJar?.enabled && (
                  <Button 
                    variant="outline" 
                    className="w-full sm:w-auto bg-background/60 backdrop-blur-md border-2"
                    style={{ borderColor: data.accentColor || '#3b82f6' }}
                    onClick={() => alert(`Support ${data.displayName}!`)}
                  >
                    <Heart className="w-4 h-4 mr-2" style={{ color: data.accentColor || '#3b82f6' }} />
                    {data.tipJar.title}
                  </Button>
                )}

                <ShareButton 
                  title={`${data.displayName}'s Profile`}
                  className="w-full sm:w-auto bg-background/60 backdrop-blur-md border-2"
                  style={{ borderColor: data.accentColor || '#3b82f6' }}
                  iconStyle={{ color: data.accentColor || '#3b82f6' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Main Content: Bio and Story */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Bio Section */}
            {(data.bio || data.bioImage?.url || data.bioVideo?.url) && (
              <section>
                <h2 className="text-2xl md:text-3xl font-bold mb-6" style={{ color: data.accentColor || '#3b82f6' }}>
                  {data.bioSectionTitle || 'Biography / My Story'}
                </h2>
                
                <div className="space-y-6">
                  {data.bioMode === 'video' && data.bioVideo?.url ? (
                    <div className="aspect-video w-full overflow-hidden rounded-2xl shadow-lg">
                      {data.bioVideo.type === 'youtube' ? (
                        <iframe src={data.bioVideo.url} className="w-full h-full" allowFullScreen />
                      ) : (
                        <video src={data.bioVideo.url} controls className="w-full h-full" />
                      )}
                    </div>
                  ) : (
                    data.bioImage?.url && (
                      <img src={data.bioImage.url} alt="Bio" className="w-full max-w-2xl rounded-2xl shadow-md" />
                    )
                  )}
                  {data.bio && (
                    <p className="text-lg text-foreground/90 leading-relaxed whitespace-pre-wrap">
                      {data.bio}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* Story Chapters: Using 1 column on mobile, 2/3 on desktop */}
            {data.storySections?.length > 0 && (
              <section className="space-y-10">
                <h2 className="text-2xl md:text-3xl font-bold" style={{ color: data.accentColor || '#3b82f6' }}>
                  {data.chaptersSectionTitle || 'Story Chapters'}
                </h2>
                
                {data.storySections.map((section) => {
                  const sectionMedia = data[`storySection_${section.id}`] || [];
                  return (
                    <div key={section.id} className="border-l-4 pl-6 md:pl-8 space-y-4" style={{ borderColor: data.accentColor || '#3b82f6' }}>
                      <h3 className="text-xl md:text-2xl font-bold">{section.title}</h3>
                      <p className="text-muted-foreground text-lg whitespace-pre-wrap">{section.description}</p>
                      
                      {sectionMedia.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                          {sectionMedia.map((media) => (
                            <div key={media.id} className="group relative">
                              <div className="aspect-square rounded-xl overflow-hidden bg-muted">
                                {media.type === 'image' && <img src={media.url} className="w-full h-full object-cover" />}
                                {media.type === 'video' && <video src={media.url} className="w-full h-full object-cover" />}
                                {media.type === 'audio' && (
                                  <div className="flex flex-col items-center justify-center h-full p-4">
                                    <Music className="w-8 h-8 mb-2" />
                                    <audio src={media.url} controls className="w-full scale-75" />
                                  </div>
                                )}
                              </div>
                              {media.caption && <p className="mt-2 text-xs text-muted-foreground italic">{media.caption}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            )}
          </div>

          {/* Sidebar: Appears at the bottom on mobile */}
          <div className="space-y-6">
            <Card className="border-none bg-muted/30">
              <div className="p-6">
                <h3 className="font-bold text-lg mb-4">Connect</h3>
                <div className="space-y-4">
                  {data.location && (
                    <div className="flex items-start gap-3 text-sm">
                      <MapPin className="w-5 h-5 text-muted-foreground shrink-0" />
                      <span>{data.location}</span>
                    </div>
                  )}
                  {data.email && (
                    <div className="flex items-start gap-3 text-sm">
                      <Mail className="w-5 h-5 text-muted-foreground shrink-0" />
                      <a href={`mailto:${data.email}`} className="hover:underline break-all">{data.email}</a>
                    </div>
                  )}
                  {data.website && (
                    <div className="flex items-start gap-3 text-sm">
                      <Globe className="w-5 h-5 text-muted-foreground shrink-0" />
                      <a href={data.website} target="_blank" className="hover:underline truncate">{data.website}</a>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {data.tipJar?.enabled && (
              <Card className="border-2 shadow-xl" style={{ borderColor: data.accentColor }}>
                <div className="p-6 text-center">
                  <Heart className="w-8 h-8 mx-auto mb-3" style={{ color: data.accentColor }} />
                  <h3 className="font-bold text-lg mb-2">{data.tipJar.title}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{data.tipJar.description}</p>
                  <Button className="w-full font-bold" style={{ backgroundColor: data.accentColor }}>
                    Send Support
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