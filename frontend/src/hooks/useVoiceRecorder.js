import { useState, useRef } from 'react'

export function useVoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [audioBlob, setAudioBlob] = useState(null)
    const mediaRecorderRef = useRef(null)
    const chunksRef = useRef([])
    const timerRef = useRef(null)
    const startTimeRef = useRef(null)

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })
            mediaRecorderRef.current = mediaRecorder
            chunksRef.current = []

            mediaRecorder.ondataavailable = (e) => chunksRef.current.push(e.data)
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
                setAudioBlob(blob)
                chunksRef.current = []
                stream.getTracks().forEach(t => t.stop())
            }

            mediaRecorder.start()
            setIsRecording(true)
            startTimeRef.current = Date.now()
            
            // Auto stop after 60 seconds
            timerRef.current = setTimeout(() => {
                stopRecording()
            }, 60000)
        } catch (error) {
            console.error("Microphone access failed", error);
            alert("Microphone access failed. Please check permissions.");
        }
    }

    const stopRecording = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
        }
        
        const duration = Date.now() - (startTimeRef.current || 0)
        if (duration < 500) {
            console.warn("Recording too short (<500ms), ignoring.")
            if (mediaRecorderRef.current) {
                // Remove the ondataavailable and onstop so we don't save the blob
                mediaRecorderRef.current.onstop = null
                mediaRecorderRef.current.ondataavailable = null
                mediaRecorderRef.current.stop()
            }
            setIsRecording(false)
            return
        }

        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
        }
        setIsRecording(false)
    }

    const clearAudio = () => setAudioBlob(null)

    return { isRecording, audioBlob, startRecording, stopRecording, clearAudio }
}
