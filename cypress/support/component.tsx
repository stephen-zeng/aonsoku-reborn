/* eslint-disable @typescript-eslint/no-namespace */

// ***********************************************************
// This example support/component.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { mount } from 'cypress/react'
import { MemoryRouter } from 'react-router-dom'
import { useAppStore } from '@/store/app.store'
import { AuthType } from '@/types/serverConfig'
import { useThemeStore } from '@/store/theme.store'
import { Theme } from '@/types/themeContext'
import 'cypress-real-events'
import '@/index.css'
import '@/fonts.css'
import '@/i18n'

const queryClient = new QueryClient()

useAppStore.setState((state) => ({
  ...state,
  data: {
    // fix cy.intercept that wasn't intercepting requests without a base URL
    url: 'http://localhost:1420',
    // set a default authType to avoid errors
    authType: AuthType.TOKEN,
  },
}))

Cypress.on('uncaught:exception', (err) => {
  if (err.message.includes('ResizeObserver loop completed with undelivered notifications')) {
    return false
  }
  return true
})

beforeEach(() => {
  const theme = useThemeStore.getState().theme || Theme.Dark
  cy.document().then((doc) => {
    doc.documentElement.classList.add(theme)
  })
})

Cypress.Commands.add('mount', (component, options = {}) => {
  const { routerProps = { initialEntries: ['/'] }, ...mountOptions } = options

  const wrapped = (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter {...routerProps}>{component}</MemoryRouter>
    </QueryClientProvider>
  )

  return mount(wrapped, mountOptions)
})
