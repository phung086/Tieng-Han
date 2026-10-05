"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink,
  FileText,
  ImageIcon,
  Maximize2,
  Music2,
  PlayCircle,
  X,
} from "lucide-react";
import type { LessonMedia } from "@/data/content";
import { useMessages } from "@/i18n/messages";
import { ingestionConfig } from "@/config/ingestion";

function youtubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes("youtu.be")) {
      const id = parsed.pathname.replace(/^\//, "");
      return id ? "https://www.youtube.com/embed/" + id : null;
    }

    if (parsed.hostname.includes("youtube.com")) {
      const id = parsed.searchParams.get("v");
      if (id) return "https://www.youtube.com/embed/" + id;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const embedIndex = parts.findIndex((part) => part === "embed");
      if (embedIndex >= 0 && parts[embedIndex + 1]) {
        return "https://www.youtube.com/embed/" + parts[embedIndex + 1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function vimeoEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("vimeo.com")) return null;

    const id = parsed.pathname
      .split("/")
      .filter(Boolean)
      .find((part) => /^\d+$/.test(part));

    return id ? "https://player.vimeo.com/video/" + id : null;
  } catch {
    return null;
  }
}

function videoEmbedUrl(url: string) {
  return youtubeEmbedUrl(url) ?? vimeoEmbedUrl(url);
}

export function LessonMediaGallery({
  media,
}: {
  media: LessonMedia[];
}) {
  const [activeImage, setActiveImage] = useState<LessonMedia | null>(null);
  const [expanded, setExpanded] = useState(false);
  const messages = useMessages();

  const ordered = useMemo(
    () =>
      [...media].sort((a, b) => {
        const priority = (item: LessonMedia) => {
          if (item.type === "video") return 0;
          if (item.type === "audio") return 1;
          if (item.role === "illustration") return 2;
          if (item.type === "image") return 3;
          return 4;
        };

        return priority(a) - priority(b);
      }),
    [media],
  );

  if (!ordered.length) return null;

  const visibleMedia = expanded
    ? ordered
    : ordered.slice(0, ingestionConfig.lesson.initialVisibleMediaItems);
  const hasMore =
    ordered.length > ingestionConfig.lesson.initialVisibleMediaItems;

  return (
    <>
      <section className="lesson-media-section">
        <div className="lesson-media-heading">
          <div>
            <span className="eyebrow">{messages.media.eyebrow}</span>
            <h2>{messages.media.title}</h2>
          </div>
          <span>{ordered.length} {messages.media.sourceItems}</span>
        </div>

        <div className="lesson-media-grid">
          {visibleMedia.map((item) => {
            if (item.type === "image") {
              return (
                <article className="lesson-media-card image-card" key={item.id}>
                  <button
                    className="lesson-media-image-button"
                    onClick={() => setActiveImage(item)}
                    type="button"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.src} alt={item.alt} />
                    <span><Maximize2 size={16} /> {messages.media.zoom}</span>
                  </button>

                  <div className="lesson-media-meta">
                    <div className="lesson-media-type">
                      <ImageIcon size={14} />
                      <span>
                        {item.role === "illustration" ? messages.media.illustration : messages.media.sourcePage}
                      </span>
                    </div>
                    {item.caption ? <p>{item.caption}</p> : null}
                    {item.sourceRef ? <small>{item.sourceRef}</small> : null}
                  </div>
                </article>
              );
            }

            if (item.type === "video") {
              const embed = videoEmbedUrl(item.src);

              return (
                <article className="lesson-media-card video-card" key={item.id}>
                  <div className="lesson-media-player">
                    {embed ? (
                      <iframe
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        src={embed}
                        title={item.alt}
                      />
                    ) : (
                      <a href={item.src} rel="noreferrer" target="_blank">
                        <PlayCircle size={34} />
                        <span>{messages.media.openVideo}</span>
                      </a>
                    )}
                  </div>
                  <div className="lesson-media-meta">
                    <div className="lesson-media-type">
                      <PlayCircle size={14} />
                      <span>{messages.media.video}</span>
                    </div>
                    {item.sourceRef ? <small>{item.sourceRef}</small> : null}
                  </div>
                </article>
              );
            }

            if (item.type === "audio") {
              return (
                <article className="lesson-media-card audio-card" key={item.id}>
                  <div className="lesson-media-audio">
                    <Music2 size={22} />
                    <audio controls preload="metadata" src={item.src} />
                  </div>
                  <div className="lesson-media-meta">
                    <div className="lesson-media-type">
                      <Music2 size={14} />
                      <span>{messages.media.audio}</span>
                    </div>
                    {item.sourceRef ? <small>{item.sourceRef}</small> : null}
                  </div>
                </article>
              );
            }

            return (
              <article className="lesson-media-card document-card" key={item.id}>
                <a href={item.src} rel="noreferrer" target="_blank">
                  <FileText size={24} />
                  <div>
                    <strong>{messages.media.linkedDocument}</strong>
                    <span>{item.sourceRef ?? item.alt}</span>
                  </div>
                  <ExternalLink size={16} />
                </a>
              </article>
            );
          })}
        </div>

        {hasMore ? (
          <button
            className="lesson-media-expand"
            type="button"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? messages.media.showLess : messages.media.showAll}
          </button>
        ) : null}
      </section>

      {activeImage ? (
        <div className="media-lightbox" role="dialog" aria-modal="true">
          <button
            className="media-lightbox-close"
            onClick={() => setActiveImage(null)}
            type="button"
            aria-label={messages.media.closeImage}
          >
            <X size={20} />
          </button>
          <div className="media-lightbox-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={activeImage.src} alt={activeImage.alt} />
            <div>
              <strong>{activeImage.caption || activeImage.alt}</strong>
              {activeImage.sourceRef ? <span>{activeImage.sourceRef}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
