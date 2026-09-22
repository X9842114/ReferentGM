"use client"

import { motion, useReducedMotion } from "framer-motion"
import { Check, Clock3, FileText } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export interface ProfileHoverCardProps {
  name?: string
  description?: string
  image?: string
  isVerified?: boolean
  followers?: number | string
  following?: number | string
  followersLabel?: string
  followingLabel?: string
  ctaLabel?: string
  followingCtaLabel?: string
  enableAnimations?: boolean
  className?: string
  size?: "md" | "sm"
  onFollow?: () => void
  isFollowing?: boolean
}

const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=800&q=80"

export function ProfileCard({
  name = "Sophie Bennett",
  description = "Product Designer who focuses on simplicity & usability.",
  image = FALLBACK_IMAGE,
  isVerified = true,
  followers = 312,
  following = 48,
  followersLabel = "missions",
  followingLabel = "activité",
  ctaLabel = "Follow +",
  followingCtaLabel = "Following",
  enableAnimations = true,
  className,
  size = "md",
  onFollow = () => {},
  isFollowing = false,
}: ProfileHoverCardProps) {
  const [hovered, setHovered] = useState(false)
  const shouldReduceMotion = useReducedMotion()
  const shouldAnimate = enableAnimations && !shouldReduceMotion

  const containerVariants = {
    rest: {
      scale: 1,
      y: 0,
      filter: "blur(0px)",
    },
    hover: shouldAnimate
      ? {
          scale: 1.02,
          y: -4,
          filter: "blur(0px)",
          transition: {
            type: "spring" as const,
            stiffness: 400,
            damping: 28,
            mass: 0.6,
          },
        }
      : {},
  }

  const imageVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.05 },
  }

  const contentVariants = {
    hidden: {
      opacity: 0,
      y: 20,
      filter: "blur(4px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 28,
        mass: 0.6,
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  }

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: 15,
      scale: 0.95,
      filter: "blur(2px)",
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        type: "spring" as const,
        stiffness: 400,
        damping: 25,
        mass: 0.5,
      },
    },
  }

  const letterVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring" as const,
        damping: 8,
        stiffness: 200,
        mass: 0.8,
      },
    },
  }

  const compact = size === "sm"

  return (
    <motion.div
      data-slot="profile-hover-card"
      data-hovered={hovered}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      initial="rest"
      whileHover="hover"
      variants={containerVariants}
      className={cn(
        "relative overflow-hidden border border-border/20 text-card-foreground shadow-xl shadow-black/5 cursor-pointer group backdrop-blur-sm dark:shadow-black/20",
        compact
          ? "h-48 w-36 shrink-0 rounded-2xl"
          : "h-64 w-48 shrink-0 rounded-2xl",
        className
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <motion.img
        src={image}
        alt={name}
        className="absolute inset-0 w-full h-full object-cover"
        variants={imageVariants}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 via-background/20 via-background/10 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-background/90 via-background/60 via-background/30 via-background/15 via-background/8 to-transparent backdrop-blur-[1px]" />
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/85 via-background/40 to-transparent backdrop-blur-sm" />

      <motion.div
        variants={contentVariants}
        initial="hidden"
        animate="visible"
        className={cn(
          "absolute bottom-0 left-0 right-0",
          compact ? "space-y-1.5 p-2.5" : "space-y-2.5 p-3.5"
        )}
      >
        <motion.div variants={itemVariants} className="flex items-center gap-1.5">
          <motion.h2
            className={cn(
              "font-bold leading-tight text-foreground",
              compact ? "text-sm" : "text-base"
            )}
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.02,
                },
              },
            }}
          >
            {name.split("").map((letter, index) => (
              <motion.span
                key={`${letter}-${index}`}
                variants={letterVariants}
                className="inline-block"
              >
                {letter === " " ? "\u00A0" : letter}
              </motion.span>
            ))}
          </motion.h2>
          {isVerified && (
            <motion.div
              variants={itemVariants}
              className="flex items-center justify-center w-4 h-4 rounded-full bg-green-500 text-white"
              whileHover={{
                scale: 1.1,
                rotate: 5,
                transition: { type: "spring", stiffness: 400, damping: 20 },
              }}
            >
              <Check className="w-2.5 h-2.5" />
            </motion.div>
          )}
        </motion.div>

        <motion.p
          variants={itemVariants}
          className={cn(
            "text-muted-foreground leading-snug line-clamp-2",
            compact ? "text-[10px]" : "text-xs"
          )}
        >
          {description}
        </motion.p>

        <motion.div
          variants={itemVariants}
          className={cn("flex items-center", compact ? "gap-2" : "gap-3")}
        >
          <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <FileText className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            <span className={cn("font-semibold tabular-nums text-foreground", compact ? "text-[10px]" : "text-xs")}>
              {followers}
            </span>
            <span className={cn("truncate", compact ? "text-[9px]" : "text-[11px]")}>
              {followersLabel}
            </span>
          </div>
          <div className="flex min-w-0 items-center gap-1 text-muted-foreground">
            <Clock3 className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
            <span className={cn("tabular-nums text-foreground", compact ? "text-[9px] font-medium" : "text-[10px] font-medium")}>
              {following}
            </span>
            <span className={cn("truncate", compact ? "text-[9px]" : "text-[11px]")}>
              {followingLabel}
            </span>
          </div>
        </motion.div>

        <motion.button
          type="button"
          variants={itemVariants}
          onClick={onFollow}
          whileHover={{
            scale: 1.02,
            transition: { type: "spring", stiffness: 400, damping: 25 },
          }}
          whileTap={{ scale: 0.98 }}
          className={cn(
            "w-full cursor-pointer font-semibold transition-all duration-200",
            compact
              ? "rounded-lg px-2 py-1.5 text-[10px]"
              : "rounded-xl px-3 py-2 text-xs",
            "border border-border/20 shadow-sm",
            isFollowing
              ? "bg-muted text-muted-foreground hover:bg-muted/80"
              : "bg-foreground text-background hover:bg-foreground/90",
            "transform-gpu"
          )}
        >
          {isFollowing ? followingCtaLabel : ctaLabel}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}
