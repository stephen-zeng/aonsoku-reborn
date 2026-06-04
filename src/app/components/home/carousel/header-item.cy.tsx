import { Albums } from '@/types/responses/album'
import { HeaderItem } from './header-item'

describe('HeaderItem Component', () => {
  beforeEach(() => {
    cy.mockCoverArt()
  })

  it('mounts the component and show the album', () => {
    cy.fixture('albums/album').then((album: Albums) => {
      cy.mount(<HeaderItem album={album} />)

      cy.getByTestId('header-bg').should('have.css', 'background-image')

      cy.getByTestId('header-title').should('have.text', album.name)
      cy.getByTestId('header-artist').should('have.text', album.artist)

      cy.getByTestId('header-genre').should('have.text', album.genre)
      cy.getByTestId('header-year').should('have.text', String(album.year))
      cy.getByTestId('header-duration').should('have.text', '34:46')
    })
  })

  it('should render on hd displays', () => {
    cy.viewport(1280, 720)

    cy.fixture('albums/album').then((album: Albums) => {
      cy.mount(<HeaderItem album={album} />)

      cy.getByTestId('header-image-container').should('exist')
      cy.getByTestId('header-bg').should('have.css', 'background-image')
      cy.getByTestId('header-title').should('have.text', album.name)
    })
  })

  it('should render on full hd displays', () => {
    cy.fixture('albums/album').then((album: Albums) => {
      cy.mount(<HeaderItem album={album} />)

      cy.getByTestId('header-image-container').should('exist')
      cy.getByTestId('header-bg').should('have.css', 'background-image')
      cy.getByTestId('header-title').should('have.text', album.name)
    })
  })
})
