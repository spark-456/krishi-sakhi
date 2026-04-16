import { useState, useRef } from 'react'

export function useVoiceRecorder() {
    const [isRecording, setIsRecording] = useState(false)
    const [audioBlob, setAudioBlob] = useState(null)
    const mediaRecorderRef = useRef(null)
    const chunksRef = useRef([])

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
        } catch (error) {
            console.error("Microphone access failed", error);
            alert("Microphone access failed. Please check permissions.");
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop()
        }
        setIsRecording(false)
    }

    const clearAudio = () => setAudioBlob(null)

    return { isRecording, audioBlob, startRecording, stopRecording, clearAudio }
}
