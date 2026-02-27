import { useState } from 'react'
import { inviteMembersByEmail } from "@/lib/api/members/inviteMembers";
import Modal from '@/components/ui/Modal'

type InviteMembersModalProps = {
  boardId: number
  onClose: () => void
}

export default function InviteMembersModal({ boardId, onClose }: InviteMembersModalProps ) {
  const [emails, setEmails] = useState<string[]>([])
  const [input, setInput] = useState('')

  const addEmail = () => {
    const newEmails = input.split(',').map(e => e.trim()).filter(Boolean)
    setEmails(prev => [...prev, ...newEmails])
    setInput('')
  }

  return (
    <Modal isOpen onClose={onClose} title="Invite Members">
      <div className="space-y-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEmail()}
          placeholder="Enter emails, comma separated"
          className="app-input"
        />
        <div className="flex flex-wrap gap-2">
          {emails.map((email, i) => (
            <span key={i} className="app-badge">
              {email}
            </span>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="glass-button">Cancel</button>
          <button onClick={() => inviteMembersByEmail({ boardId, emails })}
            className="glass-button glass-button-primary"
          >
            Send Invites
          </button>
        </div>
      </div>
    </Modal>
  )
}
