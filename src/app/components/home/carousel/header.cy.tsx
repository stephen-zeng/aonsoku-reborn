import { ISong } from '@/types/responses/song'
import HomeHeader from './header'

describe('HomeHeader Component', () => {
  it('should not show component if songs list is empty', () => {
    cy.mount(<HomeHeader songs={[]} />)

    cy.getByTestId('header-carousel').should('not.exist')
  })

  it('mounts the component and shows the songs correctly', () => {
    cy.mockCoverArt()

    cy.fixture('songs/random').then((songs: ISong[]) => {
      cy.mount(<HomeHeader songs={songs} />)

      songs.forEach((song, index) => {
        cy.getByTestId(`carousel-header-song-${index}`).as('activeCarousel')

        cy.get('@activeCarousel')
          .findByTestId('header-bg')
          .should('have.css', 'background-image')

        cy.get('@activeCarousel')
          .findByTestId('header-title')
          .should('have.text', song.title)

        cy.get('@activeCarousel')
          .findByTestId('header-artist')
          .should('have.text', song.artist)

        cy.get('@activeCarousel')
          .findByTestId('header-genre')
          .should('have.text', song.genre)

        cy.get('@activeCarousel')
          .findByTestId('header-year')
          .should('have.text', song.year)
      })

      cy.getByTestId('header-carousel-previous')
        .should('be.visible')
        .and('be.enabled')

      cy.getByTestId('header-carousel-next')
        .should('be.visible')
        .and('be.enabled')
    })
  })

  it('moves the carousel with horizontal wheel input', () => {
    cy.mockCoverArt()

    cy.fixture('songs/random').then((songs: ISong[]) => {
      cy.mount(<HomeHeader songs={songs} />)

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

    cy.fixture('songs/random').then((songs: ISong[]) => {
      cy.mount(<HomeHeader songs={songs} />)

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
