'use client'

import { useState } from 'react'

import Modal from '@/components/ui/Modal'
import { inviteMembersByEmail } from '@/lib/api/members/inviteMembers'

type InviteMembersModalProps = {
  boardId: number
  onClose: () => void
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InviteMembersModal({ boardId, onClose }: InviteMembersModalProps) {
  const [emails, setEmails] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function normalizeEmails(rawValue: string) {
    return rawValue
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
  }

  function appendEmails(rawValue: string) {
    const parsedEmails = normalizeEmails(rawValue)
    if (parsedEmails.length === 0) {
      return
    }

    const nextEmails = [...emails]
    const seenEmails = new Set(emails.map((email) => email.toLowerCase()))
    const invalidEmails: string[] = []

    for (const email of parsedEmails) {
      if (!EMAIL_PATTERN.test(email)) {
        invalidEmails.push(email)
        continue
      }

      const normalized = email.toLowerCase()
      if (seenEmails.has(normalized)) {
        continue
      }

      seenEmails.add(normalized)
      nextEmails.push(email)
    }

    setEmails(nextEmails)
    setInput('')
    setSuccessMessage('')

    if (invalidEmails.length > 0) {
      setErrorMessage(`Invalid email${invalidEmails.length > 1 ? 's' : ''}: ${invalidEmails.join(', ')}`)
      return
    }

    setErrorMessage('')
  }

  function removeEmail(emailToRemove: string) {
    setEmails((current) => current.filter((email) => email !== emailToRemove))
    setErrorMessage('')
    setSuccessMessage('')
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return
    }

    const pendingEmails = normalizeEmails(input)
    const combinedEmails = pendingEmails.length > 0 ? [...emails, ...pendingEmails] : emails
    const dedupedEmails = Array.from(new Map(combinedEmails.map((email) => [email.toLowerCase(), email])).values())
    const invalidEmails = dedupedEmails.filter((email) => !EMAIL_PATTERN.test(email))

    if (invalidEmails.length > 0) {
      setErrorMessage(`Invalid email${invalidEmails.length > 1 ? 's' : ''}: ${invalidEmails.join(', ')}`)
      return
    }

    if (dedupedEmails.length === 0) {
      setErrorMessage('Add at least one valid email before sending invites.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')
    setSuccessMessage('')

    try {
      const result = await inviteMembersByEmail({ boardId, emails: dedupedEmails })
      setSuccessMessage(result.message || 'Invites sent successfully.')
      setEmails([])
      setInput('')
      onClose()
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to send invites.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Invite Members">
      <div className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="invite-members-input" className="text-sm font-medium">
            Email addresses
          </label>
          <input
            id="invite-members-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onBlur={() => appendEmails(input)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                appendEmails(input)
              }
            }}
            placeholder="Enter emails and press Enter"
            className="app-input"
          />
          <p className="text-xs app-text-muted">
            Add one or more teammate emails. Separate multiple addresses with commas.
          </p>
        </div>

        {emails.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {emails.map((email) => (
              <button
                key={email}
                type="button"
                onClick={() => removeEmail(email)}
                className="app-badge"
                aria-label={`Remove ${email}`}
              >
                {email} ×
              </button>
            ))}
          </div>
        ) : null}

        {errorMessage ? <p className="text-sm text-rose-400">{errorMessage}</p> : null}
        {successMessage ? <p className="text-sm text-emerald-400">{successMessage}</p> : null}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="glass-button">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || (emails.length === 0 && input.trim().length === 0)}
            className="glass-button glass-button-primary disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Sending...' : 'Send Invites'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
