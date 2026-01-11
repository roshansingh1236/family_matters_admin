import React, { useState, useMemo } from 'react';
import Card from '../base/Card';

export interface MediaItem {
  type: 'image' | 'video';
  url: string;
  uploadedAt: string;
}

interface MediaGalleryProps {
  media: MediaItem[];
  isLoading?: boolean;
}

type FilterType = 'all' | 'image' | 'video';

const MediaGallery: React.FC<MediaGalleryProps> = ({ media = [], isLoading = false }) => {
  const [filter, setFilter] = useState<FilterType>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const filteredMedia = useMemo(() => {
    if (filter === 'all') return media;
    return media.filter(item => item.type === filter);
  }, [media, filter]);

  const imageItems = useMemo(() => 
    filteredMedia.filter(item => item.type === 'image'),
    [filteredMedia]
  );

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  const openLightbox = (index: number) => {
    const imageIndex = imageItems.findIndex(item => item.url === filteredMedia[index].url);
    setLightboxIndex(imageIndex);
  };

  const closeLightbox = () => setLightboxIndex(null);

  const nextImage = () => {
    if (lightboxIndex !== null && lightboxIndex < imageItems.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const prevImage = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  const photosCount = media.filter(item => item.type === 'image').length;
  const videosCount = media.filter(item => item.type === 'video').length;

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <i className="ri-gallery-line mr-2"></i>
          All ({media.length})
        </button>
        <button
          onClick={() => setFilter('image')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'image'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <i className="ri-image-line mr-2"></i>
          Photos ({photosCount})
        </button>
        <button
          onClick={() => setFilter('video')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            filter === 'video'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <i className="ri-video-line mr-2"></i>
          Videos ({videosCount})
        </button>
      </div>

      {/* Loading State */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="aspect-square rounded-xl bg-gray-200 dark:bg-gray-700 animate-pulse" />
          ))}
        </div>
      ) : filteredMedia.length === 0 ? (
        /* Empty State */
        <Card className="p-12 text-center">
          <i className="ri-image-line text-6xl text-gray-300 dark:text-gray-600 mb-4"></i>
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
            No {filter !== 'all' ? `${filter}s` : 'media'} available
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filter !== 'all' 
              ? `No ${filter}s have been uploaded yet.`
              : 'No photos or videos have been uploaded yet.'
            }
          </p>
        </Card>
      ) : (
        /* Media Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMedia.map((item, index) => (
            <div key={`${item.url}-${index}`} className="group relative">
              {item.type === 'image' ? (
                <div 
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 cursor-pointer transition-transform hover:scale-105"
                  onClick={() => openLightbox(index)}
                >
                  <img
                    src={item.url}
                    alt={`Uploaded on ${formatDate(item.uploadedAt)}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <i className="ri-zoom-in-line text-white text-3xl opacity-0 group-hover:opacity-100 transition-opacity"></i>
                  </div>
                </div>
              ) : (
                <div className="aspect-square rounded-xl overflow-hidden bg-gray-900">
                  <video
                    src={item.url}
                    controls
                    className="w-full h-full object-cover"
                    preload="metadata"
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              )}
              
              {/* Upload Date Badge */}
              <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                <i className="ri-calendar-line mr-1"></i>
                {formatDate(item.uploadedAt)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxIndex !== null && imageItems[lightboxIndex] && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white text-3xl hover:bg-white/10 rounded-full w-12 h-12 flex items-center justify-center transition-colors"
          >
            <i className="ri-close-line"></i>
          </button>

          {/* Previous Button */}
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); prevImage(); }}
              className="absolute left-4 text-white text-4xl hover:bg-white/10 rounded-full w-14 h-14 flex items-center justify-center transition-colors"
            >
              <i className="ri-arrow-left-s-line"></i>
            </button>
          )}

          {/* Image */}
          <div className="max-w-5xl max-h-[90vh] relative" onClick={(e) => e.stopPropagation()}>
            <img
              src={imageItems[lightboxIndex].url}
              alt={`Photo uploaded on ${formatDate(imageItems[lightboxIndex].uploadedAt)}`}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm">
              {lightboxIndex + 1} / {imageItems.length}
            </div>
          </div>

          {/* Next Button */}
          {lightboxIndex < imageItems.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); nextImage(); }}
              className="absolute right-4 text-white text-4xl hover:bg-white/10 rounded-full w-14 h-14 flex items-center justify-center transition-colors"
            >
              <i className="ri-arrow-right-s-line"></i>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaGallery;
