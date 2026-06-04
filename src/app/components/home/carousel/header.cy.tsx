import { Albums } from '@/types/responses/album'
import HomeHeader from './header'

describe('HomeHeader Component', () => {
  it('should not show component if albums list is empty', () => {
    cy.mount(<HomeHeader albums={[]} />)

    cy.getByTestId('header-carousel').should('not.exist')
  })

  it('mounts the component and shows the albums correctly', () => {
    cy.mockCoverArt()

    cy.fixture('albums/mostPlayed').then((albums: Albums[]) => {
      cy.mount(<HomeHeader albums={albums} />)

      albums.forEach((album, index) => {
        cy.getByTestId(`carousel-header-album-${index}`).as('activeCarousel')

        cy.get('@activeCarousel')
          .findByTestId('header-bg')
          .should('have.css', 'background-image')

        cy.get('@activeCarousel')
          .findByTestId('header-title')
          .should('have.text', album.name)

        cy.get('@activeCarousel')
          .findByTestId('header-artist')
          .should('have.text', album.artist)

        if (album.genre !== undefined) {
          cy.get('@activeCarousel')
            .findByTestId('header-genre')
            .should('have.text', album.genre)
        } else {
          cy.get('@activeCarousel')
            .findByTestId('header-genre')
            .should('not.exist')
        }

        if (album.year) {
          cy.get('@activeCarousel')
            .findByTestId('header-year')
            .should('have.text', String(album.year))
        } else {
          cy.get('@activeCarousel')
            .findByTestId('header-year')
            .should('not.exist')
        }
      })

      cy.getByTestId('header-carousel-previous')
        .should('exist')
        .and('be.enabled')

      cy.getByTestId('header-carousel-next')
        .should('exist')
        .and('be.enabled')
    })
  })

  it('moves the carousel with horizontal wheel input', () => {
    cy.mockCoverArt()

    cy.fixture('albums/mostPlayed').then((albums: Albums[]) => {
      cy.mount(<HomeHeader albums={albums} />)

      cy.getByTestId('header-carousel')
        .find('.transform-gpu')
        .then(($track) => {
          const initialTransform = $track[0].style.transform

          cy.getByTestId('header-carousel').trigger('wheel', {
            deltaX: 240,
            deltaY: 0,
            deltaMode: 0,
            bubbles: true,
            cancelable: true,
          })

          cy.wait(50)

          cy.getByTestId('header-carousel')
            .find('.transform-gpu')
            .should(($updatedTrack) => {
              expect($updatedTrack[0].style.transform).not.to.eq(
                initialTransform,
              )
            })
        })
    })
  })

  it('does not move the carousel with vertical wheel input', () => {
    cy.mockCoverArt()

    cy.fixture('albums/mostPlayed').then((albums: Albums[]) => {
      cy.mount(<HomeHeader albums={albums} />)

      cy.getByTestId('header-carousel')
        .find('.transform-gpu')
        .then(($track) => {
          const initialTransform = $track[0].style.transform

          cy.getByTestId('header-carousel').trigger('wheel', {
            deltaX: 0,
            deltaY: 240,
            deltaMode: 0,
            bubbles: true,
            cancelable: true,
          })

          cy.wait(50)

          cy.getByTestId('header-carousel')
            .find('.transform-gpu')
            .should(($updatedTrack) => {
              expect($updatedTrack[0].style.transform).to.eq(initialTransform)
            })
        })
    })
  })
})
