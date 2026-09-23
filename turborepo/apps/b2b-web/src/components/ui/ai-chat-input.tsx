"use client"

import * as React from "react"
import { useRef, useState, useEffect, useCallback } from "react"
import {
  ArrowUp,
  Mic,
  Square,
  Plus,
  X,
  Sparkles,
  Bot,
  Brain,
  Cpu,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ----------------------------------------------------------------------
// Transition Physics
// ----------------------------------------------------------------------
const SPRING_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)"
const SMOOTH_HEIGHT_TRANSITION = "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), height 0.15s ease-out"

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------
export interface Attachment {
  id: string
  file: File
  url: string
  name: string
  width?: number
  height?: number
}

interface SpeechRecognitionItem {
  transcript: string
}

interface SpeechRecognitionResultItem {
  [index: number]: SpeechRecognitionItem
  isFinal: boolean
  length: number
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    [index: number]: SpeechRecognitionResultItem
    length: number
  }
}

interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((error: unknown) => void) | null
  onend: (() => void) | null
}

interface WindowWithAudio {
  AudioContext?: typeof AudioContext
  webkitAudioContext?: typeof AudioContext
  SpeechRecognition?: new () => SpeechRecognitionInstance
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance
}

// ----------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------
function MorphingText({ text }: { text: string }) {
  const [width, setWidth] = useState<number | "auto">("auto")
  const spanRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (spanRef.current) {
      setWidth(spanRef.current.offsetWidth)
    }
  }, [text])

  return (
    <span
      className="relative inline-flex items-center justify-center overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
      style={{ width }}
    >
      <span ref={spanRef} className="invisible whitespace-nowrap px-1">
        {text}
      </span>
      <span
        key={text}
        className="absolute inset-0 flex items-center justify-center whitespace-nowrap animate-in fade-in zoom-in-95 duration-300"
      >
        {text}
      </span>
    </span>
  )
}

function ModelIcon({ model, className }: { model: string; className?: string }) {
  const normalized = model.toLowerCase()
  if (normalized.includes("gemini") || normalized.includes("flash") || normalized.includes("pro")) {
    return <Sparkles className={cn("size-3.5 text-primary", className)} />
  }
  if (normalized.includes("claude") || normalized.includes("opus")) {
    return <Brain className={cn("size-3.5 text-accent", className)} />
  }
  if (normalized.includes("gpt")) {
    return <Bot className={cn("size-3.5 text-primary", className)} />
  }
  if (normalized.includes("composer") || normalized.includes("glm")) {
    return <Zap className={cn("size-3.5 text-primary", className)} />
  }
  return <Cpu className={cn("size-3.5 text-primary", className)} />
}

function DynamicBarsIcon({ level }: { level: string }) {
  const isMediumOrHigh = level === "Zbalansowany" || level === "Głęboki RAG" || level === "Medium" || level === "Max Effort"
  const isHigh = level === "Głęboki RAG" || level === "Max Effort"

  return (
    <div className="flex items-end gap-[1.5px] h-3.5 w-3.5 justify-center py-0.5" aria-hidden="true">
      <span className="w-1 h-1.5 rounded-xs bg-current transition-opacity duration-300 opacity-100" />
      <span
        className={cn(
          "w-1 h-2.5 rounded-xs bg-current transition-opacity duration-300",
          isMediumOrHigh ? "opacity-100" : "opacity-30"
        )}
      />
      <span
        className={cn(
          "w-1 h-3.5 rounded-xs bg-current transition-opacity duration-300",
          isHigh ? "opacity-100" : "opacity-30"
        )}
      />
    </div>
  )
}

// ----------------------------------------------------------------------
// Attachment Thumbnail
// ----------------------------------------------------------------------
function AttachmentThumb({
  attachment,
  index,
  onRemove,
  onOpen,
  registerRef,
}: {
  attachment: Attachment
  index: number
  onRemove: (id: string) => void
  onOpen: (attachment: Attachment, rect: DOMRect) => void
  registerRef: (id: string, el: HTMLButtonElement | null) => void
}) {
  const [isHovered, setIsHovered] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  return (
    <button
      ref={(el) => {
        btnRef.current = el
        registerRef(attachment.id, el)
      }}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (btnRef.current) {
          onOpen(attachment, btnRef.current.getBoundingClientRect())
        }
      }}
      style={{ animationDelay: `${index * 35}ms`, animationFillMode: "backwards" }}
      className={cn(
        "group relative size-12 shrink-0 overflow-hidden rounded-xl border border-border bg-muted outline-none cursor-pointer",
        "transition-transform duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:scale-[1.04] active:scale-[0.96]",
        "animate-in fade-in slide-in-from-top-3 zoom-in-90 duration-400"
      )}
      aria-label={`Otwórz podgląd ${attachment.name}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />
      <span className={cn("absolute inset-0 flex items-start justify-end bg-black/0 transition-colors duration-200", isHovered && "bg-black/25")}>
        <span
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(attachment.id)
          }}
          className={cn(
            "m-1 flex size-4 items-center justify-center rounded-full bg-background/90 text-foreground/70 shadow-xs transition-all duration-200 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-background hover:text-foreground hover:scale-110",
            isHovered ? "opacity-100 scale-100" : "opacity-0 scale-50 pointer-events-none"
          )}
          aria-label={`Usuń ${attachment.name}`}
        >
          <X className="size-2.5" />
        </span>
      </span>
    </button>
  )
}

// ----------------------------------------------------------------------
// Shared-Element Gallery Modal
// ----------------------------------------------------------------------
function AttachmentGalleryModal({
  attachment,
  originRect,
  onClose,
}: {
  attachment: Attachment
  originRect: DOMRect
  onClose: () => void
}) {
  const [phase, setPhase] = useState<"opening" | "open" | "closing">("opening")
  const [targetRect, setTargetRect] = useState<{
    top: number
    left: number
    width: number
    height: number
    radius: number
  } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  useEffect(() => {
    const maxW = Math.min(window.innerWidth * 0.86, 560)
    const maxH = Math.min(window.innerHeight * 0.78, 720)

    const naturalW = attachment.width || 800
    const naturalH = attachment.height || 600
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1.6)

    const width = naturalW * scale
    const height = naturalH * scale

    setTargetRect({
      top: (window.innerHeight - height) / 2,
      left: (window.innerWidth - width) / 2,
      width,
      height,
      radius: 20,
    })

    const raf = requestAnimationFrame(() => setPhase("open"))
    return () => cancelAnimationFrame(raf)
  }, [attachment])

  const handleClose = useCallback(() => setPhase("closing"), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [handleClose])

  const isOpen = phase === "open"
  const isClosing = phase === "closing"

  const geometry =
    isOpen && targetRect
      ? targetRect
      : {
          top: originRect.top,
          left: originRect.left,
          width: originRect.width,
          height: originRect.height,
          radius: 12,
        }

  const animEasing = isClosing ? "ease-out" : "cubic-bezier(0.175, 0.885, 0.32, 1.275)"
  const animDur = isClosing ? "0.3s" : "0.45s"
  const flipTransition = `top ${animDur} ${animEasing}, left ${animDur} ${animEasing}, width ${animDur} ${animEasing}, height ${animDur} ${animEasing}, border-radius ${animDur} ${animEasing}`

  return (
    <div className="fixed inset-0 z-[100]" onClick={handleClose} role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-background/70 backdrop-blur-md transition-opacity duration-400"
        style={{ opacity: isOpen ? 1 : 0 }}
      />
      <div
        style={{
          position: "fixed",
          top: geometry.top,
          left: geometry.left,
          width: geometry.width,
          height: geometry.height,
          borderRadius: geometry.radius,
          transition: flipTransition,
          overflow: "hidden",
          boxShadow: isOpen ? "0 24px 60px -12px rgb(0 0 0 / 0.35)" : "0 0px 0px 0px rgb(0 0 0 / 0)",
        }}
        className="bg-muted"
        onTransitionEnd={() => {
          if (phase === "closing") onClose()
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={attachment.url} alt={attachment.name} className="size-full object-cover" draggable={false} />
      </div>

      <button
        type="button"
        onClick={handleClose}
        style={{ opacity: isOpen ? 1 : 0, transform: isOpen ? "scale(1)" : "scale(0.7)" }}
        className={cn(
          "fixed right-4 top-4 flex size-9 items-center justify-center rounded-full bg-card/90 text-foreground/70 shadow-md backdrop-blur-xs cursor-pointer",
          "transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)] hover:bg-card hover:text-foreground",
          !isOpen && "pointer-events-none"
        )}
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export interface PromptInputMeta {
  model: string
  effort: string
  attachments: File[]
}

export interface PromptInputProps {
  onSubmit?: (value: string, meta: PromptInputMeta) => void
  placeholder?: string
  className?: string
  models?: string[]
  efforts?: string[]
  defaultValue?: string
  value?: string
  onChange?: (value: string) => void
  maxAttachments?: number
  collapsedMaxWidth?: number
  expandedMaxWidth?: number
}

export const PromptInput = React.forwardRef<HTMLDivElement, PromptInputProps>(
  (
    {
      onSubmit,
      placeholder = "Zadaj pytanie asystentowi AI...",
      className,
      models = ["Gemini 3.6 Flash", "Gemini 3.5 Flash", "Gemini 1.5 Pro", "Claude 3.7", "GPT-4o"],
      efforts = ["Szybki", "Zbalansowany", "Głęboki RAG"],
      defaultValue = "",
      value: controlledValue,
      onChange,
      maxAttachments = 6,
      collapsedMaxWidth = 420,
      expandedMaxWidth = 680,
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(false)
    const [isSmoothResize, setIsSmoothResize] = useState(false)
    const [localValue, setLocalValue] = useState(defaultValue)
    const [selectedModel, setSelectedModel] = useState(models[0] || "Gemini 3.6 Flash")
    const [effortIndex, setEffortIndex] = useState(1)
    const [isModelSelectOpen, setIsModelSelectOpen] = useState(false)

    const [attachments, setAttachments] = useState<Attachment[]>([])
    const [activeAttachment, setActiveAttachment] = useState<{ attachment: Attachment; rect: DOMRect } | null>(null)

    // Audio/Voice recording states
    const [isRecording, setIsRecording] = useState(false)
    const [audioData, setAudioData] = useState<number[]>(new Array(5).fill(0))
    const valueRef = useRef(controlledValue !== undefined ? controlledValue : localValue)

    // Refs for Web Audio & Speech Recognition cleanup
    const streamRef = useRef<MediaStream | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const rafRef = useRef<number | null>(null)
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
    const demoIntervalRef = useRef<number | null>(null)
    const demoTextIntervalRef = useRef<number | null>(null)

    const [hoverStyle, setHoverStyle] = useState({ opacity: 0, transform: "translateY(0px) scale(0.95)", transition: "none" })
    const [containerHeight, setContainerHeight] = useState(116)
    const [textareaHeight, setTextareaHeight] = useState(68)
    const [isScrolling, setIsScrolling] = useState(false)

    const isControlled = controlledValue !== undefined
    const value = isControlled ? controlledValue : localValue
    const hasValue = value.trim() !== "" || attachments.length > 0
    const hasAttachments = attachments.length > 0

    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const internalContainerRef = useRef<HTMLDivElement | null>(null)
    const topFadeRef = useRef<HTMLDivElement>(null)
    const bottomFadeRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const thumbRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map())

    // Sync value ref for audio callback closure
    useEffect(() => {
      valueRef.current = value
    }, [value])

    const updateFades = () => {
      const el = textareaRef.current
      if (!el) return
      const { scrollTop, scrollHeight, clientHeight } = el
      if (topFadeRef.current) {
        topFadeRef.current.style.opacity = Math.min(scrollTop / 20, 1).toString()
      }
      if (bottomFadeRef.current) {
        const bottomScroll = scrollHeight - clientHeight - scrollTop
        bottomFadeRef.current.style.opacity = Math.min(Math.max(bottomScroll - 16, 0) / 10, 1).toString()
      }
    }

    const handleValueChange = useCallback(
      (val: string) => {
        setIsSmoothResize(true)
        if (!isControlled) setLocalValue(val)
        onChange?.(val)
      },
      [isControlled, onChange]
    )

    const expand = () => {
      setIsSmoothResize(false)
      setExpanded(true)
    }

    // --- Voice Recording Logic ---
    const stopRecording = useCallback(() => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      if (audioContextRef.current) {
        void audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (demoIntervalRef.current) {
        window.clearInterval(demoIntervalRef.current)
        demoIntervalRef.current = null
      }
      if (demoTextIntervalRef.current) {
        window.clearInterval(demoTextIntervalRef.current)
        demoTextIntervalRef.current = null
      }
      setIsRecording(false)
      setAudioData(new Array(5).fill(0))
    }, [])

    const startRecording = useCallback(async () => {
      setIsSmoothResize(false)
      setExpanded(true)

      let stream: MediaStream | null = null
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        }
      } catch {
        // Fallback simulated voice mode
      }

      setIsRecording(true)

      function simulateText() {
        const fakeText = "Jakie są procedury montażu standardowego w KlikKlima i wymagane próby szczelności?"
        const words = fakeText.split(" ")
        let i = 0
        let currentBase = valueRef.current
        demoTextIntervalRef.current = window.setInterval(() => {
          if (i < words.length) {
            currentBase = (currentBase ? currentBase + " " : "") + words[i]
            handleValueChange(currentBase)
            i++
          } else {
            stopRecording()
          }
        }, 300)
      }

      if (stream) {
        streamRef.current = stream

        const win = window as unknown as WindowWithAudio
        const AudioCtx = win.AudioContext || win.webkitAudioContext
        if (AudioCtx) {
          const audioCtx = new AudioCtx()
          audioContextRef.current = audioCtx

          const analyser = audioCtx.createAnalyser()
          analyser.fftSize = 64
          const source = audioCtx.createMediaStreamSource(stream)
          source.connect(analyser)

          const dataArray = new Uint8Array(analyser.frequencyBinCount)

          const updateVisualizer = () => {
            analyser.getByteFrequencyData(dataArray)
            const bands = new Array(5).fill(0)
            const step = Math.floor(dataArray.length / 5)
            for (let i = 0; i < 5; i++) {
              let sum = 0
              for (let j = 0; j < step; j++) {
                sum += dataArray[i * step + j]
              }
              bands[i] = sum / step / 255
            }
            setAudioData(bands)
            rafRef.current = requestAnimationFrame(updateVisualizer)
          }
          updateVisualizer()
        }

        const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition
        if (SpeechRec) {
          const recognition = new SpeechRec()
          recognition.continuous = true
          recognition.interimResults = true

          let baseline = valueRef.current

          recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let interimTranscript = ""
            let finalTranscript = ""

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              const res = event.results[i]
              if (res && res[0]) {
                if (res.isFinal) {
                  finalTranscript += res[0].transcript
                } else {
                  interimTranscript += res[0].transcript
                }
              }
            }

            if (finalTranscript) {
              baseline += (baseline ? " " : "") + finalTranscript
            }

            handleValueChange((baseline + (interimTranscript ? " " + interimTranscript : "")).trim())
          }

          recognition.onerror = () => {
            stopRecording()
          }

          recognition.onend = () => {
            stopRecording()
          }

          recognitionRef.current = recognition
          recognition.start()
        } else {
          simulateText()
        }
      } else {
        demoIntervalRef.current = window.setInterval(() => {
          setAudioData(Array.from({ length: 5 }, () => Math.random() * 0.8 + 0.1))
        }, 100)
        simulateText()
      }
    }, [handleValueChange, stopRecording])

    useEffect(() => {
      if (isRecording && textareaRef.current) {
        textareaRef.current.scrollTop = textareaRef.current.scrollHeight
      }
    }, [value, isRecording])

    useEffect(() => {
      return () => {
        stopRecording()
        attachments.forEach((a) => URL.revokeObjectURL(a.url))
      }
    }, [stopRecording, attachments])

    useEffect(() => {
      if ((value.trim() !== "" || hasAttachments) && !expanded) {
        setIsSmoothResize(false)
        setExpanded(true)
      }
    }, [value, expanded, hasAttachments])

    useEffect(() => {
      if (expanded && !isRecording) {
        const timer = setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus()
            const length = textareaRef.current.value.length
            textareaRef.current.setSelectionRange(length, length)
          }
        }, 50)
        return () => clearTimeout(timer)
      }
    }, [expanded, isRecording])

    useEffect(() => {
      if (!textareaRef.current) return
      const el = textareaRef.current

      const currentHeight = el.style.height
      el.style.transition = "none"
      el.style.height = "0px"
      const scrollHeight = el.scrollHeight
      el.style.height = currentHeight
      void el.offsetHeight
      el.style.transition = ""

      const newHeight = Math.max(68, Math.min(scrollHeight, 180))
      el.style.height = `${newHeight}px`

      setTextareaHeight(newHeight)
      setIsScrolling(scrollHeight > 180)

      setTimeout(updateFades, 0)
    }, [value, expanded])

    useEffect(() => {
      setContainerHeight(Math.max(116, textareaHeight + 48))
      setTimeout(updateFades, 0)
    }, [textareaHeight])

    useEffect(() => {
      if (!isModelSelectOpen) return
      const handleOutsideClick = (e: MouseEvent) => {
        if (internalContainerRef.current && !internalContainerRef.current.contains(e.target as Node)) {
          setIsModelSelectOpen(false)
        }
      }
      document.addEventListener("mousedown", handleOutsideClick)
      return () => document.removeEventListener("mousedown", handleOutsideClick)
    }, [isModelSelectOpen])

    const handleBlur = (e: React.FocusEvent<HTMLDivElement>) => {
      if (internalContainerRef.current && internalContainerRef.current.contains(e.relatedTarget as Node)) return
      if (value.trim() === "" && !hasAttachments && !isRecording) {
        setIsSmoothResize(false)
        setExpanded(false)
        setIsModelSelectOpen(false)
      }
    }

    const handleSubmit = () => {
      if (value.trim() === "" && !hasAttachments) return
      setIsSmoothResize(false)
      onSubmit?.(value, {
        model: selectedModel,
        effort: efforts[effortIndex] || "Zbalansowany",
        attachments: attachments.map((a) => a.file),
      })
      handleValueChange("")
      attachments.forEach((a) => URL.revokeObjectURL(a.url))
      setAttachments([])
      setExpanded(false)
      setIsModelSelectOpen(false)
    }

    const cycleEffort = (e: React.MouseEvent) => {
      e.stopPropagation()
      setEffortIndex((prev) => (prev + 1) % efforts.length)
    }

    const openFileChooser = (e: React.MouseEvent) => {
      e.stopPropagation()
      fileInputRef.current?.click()
    }

    const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"))
      e.target.value = ""

      if (files.length === 0) return
      const room = Math.max(0, maxAttachments - attachments.length)
      const accepted = files.slice(0, room)

      if (!expanded) {
        setIsSmoothResize(false)
        setExpanded(true)
      } else {
        setIsSmoothResize(true)
      }

      for (const file of accepted) {
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => addAttachment(file, url, img.naturalWidth, img.naturalHeight)
        img.onerror = () => addAttachment(file, url, 800, 600)
        img.src = url
      }
    }

    const addAttachment = (file: File, url: string, width: number, height: number) => {
      const id = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`
      setAttachments((prev) => [...prev, { id, file, url, name: file.name, width, height }])
    }

    const removeAttachment = (id: string) => {
      setIsSmoothResize(true)
      setAttachments((prev) => {
        const target = prev.find((a) => a.id === id)
        if (target) URL.revokeObjectURL(target.url)
        return prev.filter((a) => a.id !== id)
      })
      thumbRefs.current.delete(id)
    }

    const showArrow = hasValue && !isRecording
    const showStop = isRecording
    const showMic = !hasValue && !isRecording

    const onActionButtonClick = (e: React.MouseEvent) => {
      e.preventDefault()
      if (isRecording) {
        stopRecording()
      } else if (hasValue) {
        handleSubmit()
      } else {
        void startRecording()
      }
    }

    return (
      <>
        {/* Outer Wrapper for positioning and max-width scaling */}
        <div
          ref={(node) => {
            if (typeof ref === "function") {
              ref(node)
            } else if (ref) {
              ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
            }
            internalContainerRef.current = node
          }}
          onBlur={handleBlur}
          className={cn("relative flex flex-col w-full mx-auto", className)}
          style={{
            maxWidth: expanded ? expandedMaxWidth : collapsedMaxWidth,
            transition: isSmoothResize
              ? "max-width 0.15s ease-out"
              : "max-width 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesChosen}
            className="hidden"
            tabIndex={-1}
            aria-hidden="true"
          />

          {/* Independent Attachment Tab (Slides up from behind the prompt input) */}
          <div
            aria-hidden={!hasAttachments}
            style={{
              height: hasAttachments && expanded ? 68 : 0,
              transition: isSmoothResize
                ? "height 0.15s ease-out"
                : "height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
            className="w-full relative z-0 overflow-hidden"
          >
            <div
              style={{
                position: "absolute",
                bottom: -8,
                left: 20,
                right: 20,
                height: 68,
                transform: hasAttachments && expanded ? "translateY(0)" : "translateY(100%)",
                opacity: hasAttachments && expanded ? 1 : 0,
                transition: isSmoothResize
                  ? "transform 0.15s ease-out, opacity 0.15s ease-out"
                  : "transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease-out",
              }}
              className="border border-border border-b-0 bg-muted/80 rounded-t-2xl px-2.5 pt-2 pb-1 flex items-start gap-2 overflow-x-auto"
            >
              {attachments.map((attachment, index) => (
                <AttachmentThumb
                  key={attachment.id}
                  attachment={attachment}
                  index={index}
                  onRemove={removeAttachment}
                  onOpen={(a, rect) => setActiveAttachment({ attachment: a, rect })}
                  registerRef={(id, el) => thumbRefs.current.set(id, el)}
                />
              ))}
            </div>
          </div>

          {/* Main Input Card */}
          <div
            onMouseDown={(e) => {
              const isTextarea = e.target === textareaRef.current
              if (expanded && !isTextarea && !isRecording) {
                e.preventDefault()
                textareaRef.current?.focus()
              }
            }}
            style={{
              borderRadius: 24,
              height: expanded ? containerHeight : 50,
              transition: isSmoothResize ? SMOOTH_HEIGHT_TRANSITION : SPRING_TRANSITION,
              overflow: expanded ? "visible" : "hidden",
            }}
            className={cn(
              "relative w-full border border-border/70 bg-card shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 hover:border-border transition-colors z-10",
              expanded ? "cursor-text" : "cursor-default"
            )}
          >
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => handleValueChange(e.target.value)}
              onScroll={updateFades}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
                if (e.key === "Escape" && value.trim() === "" && !hasAttachments) {
                  setIsSmoothResize(false)
                  setExpanded(false)
                  setIsModelSelectOpen(false)
                }
              }}
              placeholder={placeholder}
              aria-label="Wiadomość do asystenta"
              disabled={isRecording}
              style={{
                transition: isSmoothResize
                  ? "height 0.15s ease-out"
                  : "opacity 0.3s ease-out, transform 0.3s ease-out, height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
              className={cn(
                "absolute top-0 inset-x-0 z-[1] w-full resize-none bg-transparent pl-4 pr-12 py-3.5 text-sm leading-[22px] text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground/70 cursor-text",
                expanded ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-1 pointer-events-none",
                isScrolling ? "overflow-y-auto" : "overflow-y-hidden",
                isRecording && "pointer-events-none"
              )}
            />

            <div
              ref={topFadeRef}
              className="absolute left-4 right-12 top-0 z-[2] h-7 bg-gradient-to-b from-card via-card/85 to-transparent pointer-events-none"
            />
            <div
              ref={bottomFadeRef}
              className="absolute left-4 right-12 z-[2] h-7 bg-gradient-to-t from-card via-card/85 to-transparent pointer-events-none"
              style={{
                opacity: 0,
                top: `${textareaHeight - 28}px`,
                transition: isSmoothResize ? "top 0.15s ease-out" : "top 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
              }}
            />

            <button
              type="button"
              onClick={expand}
              style={{ transition: isSmoothResize ? "none" : "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)" }}
              className={cn(
                "absolute inset-x-0 top-0 z-[1] cursor-text pl-4 pr-12 py-[15px] text-left text-sm font-normal leading-[18px] text-muted-foreground/75 outline-none",
                !expanded ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-105 translate-y-1 pointer-events-none"
              )}
              aria-label="Rozwiń pole wprowadzania"
            >
              {placeholder}
            </button>

            {/* Bottom Actions Wrapper - Hides when recording to make space for visualizer */}
            <div
              className={cn(
                "absolute bottom-2 left-3 right-12 z-[10] flex items-center gap-1 transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                expanded && !isRecording
                  ? "opacity-100 blur-0 translate-y-0 pointer-events-auto"
                  : "opacity-0 blur-xs translate-y-2 pointer-events-none"
              )}
            >
              <div className="relative">
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsModelSelectOpen((prev) => !prev)
                  }}
                  className={cn(
                    "group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-muted-foreground transition-all duration-200 outline-none hover:bg-secondary hover:text-foreground cursor-pointer text-xs font-medium border border-transparent hover:border-border/60",
                    isModelSelectOpen ? "bg-secondary text-foreground border-border/60" : ""
                  )}
                  aria-label={`Wybierz model. Aktualny: ${selectedModel}`}
                >
                  <ModelIcon model={selectedModel} className="size-3.5" />
                  <span className="font-semibold select-none transition-colors">
                    <MorphingText text={selectedModel} />
                  </span>
                </button>

                <div
                  style={{ transformOrigin: "bottom left" }}
                  onMouseLeave={() => {
                    setHoverStyle((prev) => ({
                      ...prev,
                      opacity: 0,
                      transform: prev.transform.replace("scale(1)", "scale(0.95)"),
                      transition: "opacity 0.2s ease-in, transform 0.2s ease-out",
                    }))
                  }}
                  className={cn(
                    "absolute bottom-full left-0 mb-2.5 z-50 w-48 rounded-2xl border border-border/80 bg-card p-1.5 shadow-xl backdrop-blur-md flex flex-col gap-0.5 transition-all duration-300",
                    isModelSelectOpen
                      ? "opacity-100 scale-100 translate-y-0 pointer-events-auto ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                      : "opacity-0 scale-95 translate-y-3 pointer-events-none ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
                  )}
                >
                  <div className="relative flex flex-col gap-0.5">
                    <div
                      style={hoverStyle}
                      className="absolute left-0 right-0 top-0 h-8 -z-10 rounded-xl bg-secondary pointer-events-none"
                    />
                    {models.map((model, idx) => (
                      <button
                        key={model}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseEnter={() => {
                          setHoverStyle((prev) => ({
                            opacity: 1,
                            transform: `translateY(${idx * 34}px) scale(1)`,
                            transition:
                              prev.opacity === 0
                                ? "opacity 0.15s ease-out"
                                : "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.15s ease",
                          }))
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedModel(model)
                          setIsModelSelectOpen(false)
                        }}
                        className="group relative flex h-8 w-full items-center justify-between rounded-xl px-2.5 py-1.5 text-left text-xs font-medium text-foreground/80 outline-none hover:text-foreground active:scale-[0.98] cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ModelIcon model={model} className="size-3.5" />
                          <span>{model}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={cycleEffort}
                className="group flex items-center gap-1.5 rounded-full px-2.5 py-1 text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground outline-none cursor-pointer text-xs font-medium border border-transparent hover:border-border/60"
                title="Kliknij, aby zmienić tryb precyzji / wysiłku analizy"
              >
                <DynamicBarsIcon level={efforts[effortIndex] || ""} />
                <span className="font-semibold select-none transition-colors">
                  <MorphingText text={efforts[effortIndex] || "Zbalansowany"} />
                </span>
              </button>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={openFileChooser}
                disabled={attachments.length >= maxAttachments}
                className="ml-auto flex size-7 items-center justify-center rounded-full text-muted-foreground transition-all duration-200 hover:bg-secondary hover:text-foreground outline-none cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                title="Dodaj załącznik obrazu"
              >
                <Plus className="size-4" />
              </button>
            </div>

            {/* Audio Wave Visualizer Overlay positioned precisely to the left of the mic button */}
            <div
              className={cn(
                "absolute right-12 bottom-2.5 z-[10] flex h-7 items-center justify-end gap-[3px] transition-all duration-400 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                isRecording ? "w-16 opacity-100 translate-x-0" : "w-0 opacity-0 translate-x-4 pointer-events-none"
              )}
            >
              {audioData.map((val, i) => (
                <div
                  key={i}
                  className="w-1 rounded-full bg-primary transition-[height] duration-75 ease-out"
                  style={{ height: `${Math.max(4, val * 22)}px` }}
                />
              ))}
            </div>

            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
              onClick={onActionButtonClick}
              aria-label={showArrow ? "Wyślij zapytanie" : showStop ? "Zatrzymaj nagrywanie" : "Wprowadzanie głosowe"}
              style={{ borderRadius: 9999 }}
              className="absolute right-2 bottom-2 z-[10] flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground transition-all duration-300 hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer shadow-xs"
            >
              <span className="relative flex h-full w-full items-center justify-center">
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                    showArrow ? "opacity-100 scale-100 rotate-0 blur-none" : "opacity-0 scale-50 rotate-45 blur-[1px] pointer-events-none"
                  )}
                >
                  <ArrowUp className="size-4" />
                </span>
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                    showMic ? "opacity-100 scale-100 rotate-0 blur-none" : "opacity-0 scale-50 -rotate-45 blur-[1px] pointer-events-none"
                  )}
                >
                  <Mic className="size-3.5" />
                </span>
                <span
                  className={cn(
                    "absolute inset-0 flex items-center justify-center transition-all duration-300 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]",
                    showStop ? "opacity-100 scale-100 rotate-0 blur-none" : "opacity-0 scale-50 rotate-45 blur-[1px] pointer-events-none"
                  )}
                >
                  <Square className="size-3.5 fill-current" />
                </span>
              </span>
            </button>
          </div>
        </div>

        {activeAttachment && (
          <AttachmentGalleryModal
            attachment={activeAttachment.attachment}
            originRect={activeAttachment.rect}
            onClose={() => setActiveAttachment(null)}
          />
        )}
      </>
    )
  }
)

PromptInput.displayName = "PromptInput"
