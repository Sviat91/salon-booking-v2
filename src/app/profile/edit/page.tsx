"use client"

import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import ThemeToggle from "@/components/ThemeToggle"
import LanguageToggle from "@/components/LanguageToggle"
import BackButton from "@/components/BackButton"
import PhoneInput from "@/components/ui/PhoneInput"

export default function EditProfilePage() {
  const { t } = useTranslation()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmNewPassword, setConfirmNewPassword] = useState("")

  const [profileMessage, setProfileMessage] = useState<{ type: 'success'|'error', text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success'|'error', text: string } | null>(null)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['clientProfile'],
    queryFn: async () => {
      const res = await fetch('/api/client/profile')
      if (!res.ok) throw new Error('Failed to fetch profile data')
      return res.json()
    },
  })

  // Set initial values
  useEffect(() => {
    if (profile?.user) {
      setName(profile.user.name || "")
      setEmail(profile.user.email || "")
      setPhone(profile.user.phone || "")
    }
  }, [profile?.user])

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/client/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to update profile')
      }
      return res.json()
    },
    onSuccess: () => {
      setProfileMessage({ type: 'success', text: t('profile.updateSuccess', 'Profile updated successfully') })
      queryClient.invalidateQueries({ queryKey: ['clientProfile'] })
      setTimeout(() => setProfileMessage(null), 3000)
    },
    onError: (err: any) => {
      setProfileMessage({ type: 'error', text: err.message })
    }
  })

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/client/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to change password')
      }
      return res.json()
    },
    onSuccess: () => {
      setPasswordMessage({ type: 'success', text: t('profile.passwordSuccess', 'Password changed successfully') })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmNewPassword("")
      setTimeout(() => setPasswordMessage(null), 3000)
    },
    onError: (err: any) => {
      setPasswordMessage({ type: 'error', text: err.message })
    }
  })

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setProfileMessage(null)
    updateProfileMutation.mutate()
  }

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordMessage(null)
    
    if (newPassword !== confirmNewPassword) {
      setPasswordMessage({ type: 'error', text: t('auth.passwordsDoNotMatch', 'Passwords do not match') })
      return
    }
    
    changePasswordMutation.mutate()
  }

  if (isLoading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <svg className="animate-spin h-8 w-8 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </main>
    )
  }

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <BackButton />
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      <div className="mx-auto w-full max-w-lg mt-8 space-y-6">
        <h1 className="text-2xl font-semibold text-foreground text-center">
          {t("profile.editTitle", "Edit Profile")}
        </h1>

        <Card className="!px-4 !py-6">
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("profile.personalData", "Personal Data")}
            </h2>
            
            <div className="grid gap-2">
              <Label htmlFor="name" className="text-foreground">{t('form.name', 'Name')}</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="h-11 border-input bg-background"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="email" className="text-foreground">{t('form.email', 'Email')}</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 border-input bg-background"
              />
            </div>

            <div className="grid gap-2 relative z-50">
              <Label htmlFor="phone" className="text-foreground">{t('form.phone', 'Phone')}</Label>
              <PhoneInput
                value={phone}
                onChange={setPhone}
                placeholder={t('form.phonePlaceholder', '+1 000 000 0000')}
              />
            </div>

            {profileMessage && (
              <p className={`text-sm ${profileMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {profileMessage.text}
              </p>
            )}

            <Button disabled={updateProfileMutation.isPending} type="submit" className="w-full mt-2">
              {updateProfileMutation.isPending ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
            </Button>
          </form>
        </Card>

        <Card className="!px-4 !py-6">
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              {t("profile.changePassword", "Change Password")}
            </h2>
            
            <div className="grid gap-2">
              <Label htmlFor="currentPassword" className="text-foreground">{t('profile.currentPassword', 'Current Password')}</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="h-11 border-input bg-background"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="newPassword" className="text-foreground">{t('profile.newPassword', 'New Password')}</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 border-input bg-background"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="confirmNewPassword" className="text-foreground">{t('profile.confirmNewPassword', 'Confirm New Password')}</Label>
              <Input
                id="confirmNewPassword"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                required
                minLength={6}
                className="h-11 border-input bg-background"
              />
            </div>

            {passwordMessage && (
              <p className={`text-sm ${passwordMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                {passwordMessage.text}
              </p>
            )}

            <Button disabled={changePasswordMutation.isPending} type="submit" className="w-full mt-2">
              {changePasswordMutation.isPending ? t('common.saving', 'Saving...') : t('profile.updatePasswordBtn', 'Update Password')}
            </Button>
          </form>
        </Card>
      </div>
    </main>
  )
}
