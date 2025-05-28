'use client'

import { useSearchParams } from 'next/navigation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { PiFlame, PiSpinner } from 'react-icons/pi'
import { z } from 'zod'

import { handleNewUsername } from '@/actions/actions'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cleanUsername } from '@/lib/utils'

const formSchema = z.object({
  username: z.string().min(2).max(50),
})

const NewUsernameForm = () => {
  const searchParams = useSearchParams()

  // Initialize form with react-hook-form and zod resolver
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: searchParams.get('u') || '',
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      console.log('🚀 Form submitted with values:', values)
      const cleanedUsername = cleanUsername(values.username)
      console.log('🧹 Cleaned username:', cleanedUsername)
      
      const response = await handleNewUsername({ username: cleanedUsername, redirectPath: `/${cleanedUsername}` })
      console.log('📝 Response from handleNewUsername:', response)

      if (response?.error) {
        console.log('❌ Error in response, redirecting to waitlist')
        window.location.href = 'https://tally.so/r/3lRoOp'
      }
    } catch (error) {
      console.error('❌ Error in form submission:', error)
      // Show error to user or redirect to waitlist
      window.location.href = 'https://tally.so/r/3lRoOp'
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      <Button
        asChild
        className="hidden max-w-[220px]">
        <a
          href="https://tally.so/r/3lRoOp"
          target="_blank">
          Sign up for the Waitlist
        </a>
      </Button>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm space-y-8">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <div className="flex items-center">
                    <Input
                      disabled={form.formState.isSubmitting}
                      className="w-full rounded-l-sm rounded-r-none border-black"
                      placeholder="@yourhandle"
                      {...field}
                    />
                    <Button
                      disabled={form.formState.isSubmitting}
                      type="submit"
                      className="flex-center gap-2 rounded-l-none rounded-r-sm">
                      🔮 Read My Cards
                    </Button>
                  </div>
                </FormControl>
                <p className="text-xs">
                  by clicking, you summon the cards and agree to our{' '}
                  <a
                    className="underline-offset-4 hover:underline"
                    href="/terms">
                    terms
                  </a>
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
      {/* Display loading spinner when form is submitting or submission is successful */}
      {form.formState.isSubmitting && (
        <div className="flex items-center gap-2 text-sm">
          <PiSpinner className="animate-spin" />
          Summoning the mystical forces...
        </div>
      )}
    </div>
  )
}

export default NewUsernameForm
