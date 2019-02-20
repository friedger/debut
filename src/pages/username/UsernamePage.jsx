import React, { Component } from 'react'
import PropTypes from 'prop-types'
import _ from 'lodash'
import { connect } from 'react-redux'
import { lookupProfile } from 'blockstack'
import { CSSTransitionGroup } from 'react-transition-group'
import { UserContext } from 'components/User/UserProvider'
import {
  Card,
  Columns,
  Container,
  Content,
  Media,
  Image,
  Heading,
  Modal,
  Section,
} from 'components/bulma'
import FollowButton from 'components/Follow/FollowButton'
import { fetchUserBlockstackDapps, returnFilteredUrls } from 'utils/apps'
import { withRouter } from 'react-router-dom'
import { requestUserShares } from 'actions/share'
import { addDappsToList } from 'actions/blockstack'
import './UsernamePage.scss';
import {
  UserDapps,
  UserDescription,
  UserFollowing
} from 'components/User'
import {
  NoShares,
  ShareListItem,
  ShareForm,
} from 'components/Share'
import { BarLoader, HeroAvatarLoader, Loadable } from 'components/Loader'

class UsernamePage extends Component {
  constructor(props, context) {
    super(props)

    const { sessionUser } = context.state

    this.state = {
      userInfo: {
        description: '',
        dapps: [],
      },
      loading: true,
      displayView: true,
      fileExists: false,
      bottomReached: false,
      adminMode: props.username === sessionUser.username,
      showModal: false,
      currentShare: {}
    }

    this.requestUserShares = _.debounce(this.requestUserShares, 300)
    this.handleScroll = _.debounce(this.handleScroll, 300)
  }

  static propTypes = {
    shares: PropTypes.object.isRequired,
    username: PropTypes.string.isRequired,
  }

  async componentDidMount() {
    const { username } = this.props
    const user = await lookupProfile(username)

    window.addEventListener('scroll', this.handleScroll)

    if (user) {
      this.loadUserInfo(user)
      this.requestUserShares(username)
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    const { username } = this.props
    const { sessionUser } = this.context.state

    if (prevProps.username !== username) {
      const user = await lookupProfile(username)
      if (user) {
        this.setState({ adminMode: sessionUser === username, loading: true }, () => {
          this.loadUserInfo(user)
        })
      }
    }
  }

  componentWillUnmount() {
    window.removeEventListener('scroll', this.handleScroll)
  }

  async loadUserInfo(profile) {
    const { username, dapps } = this.props
    const options = { decrypt: false, username }
    const { sessionUser } = this.context.state
    let userIntro
    let userDappsRadiks
    let following

    try {
      userIntro = await sessionUser.userSession.getFile(`user-intro-${username}.json`, options)

      const apps = _.map(profile.apps, (k,v) => {
        return v
      })

      const filteredDapps = returnFilteredUrls(apps)
      following = await sessionUser.userSession.getFile(`users-following-${username}.json`, options)
      userDappsRadiks = await fetchUserBlockstackDapps(dapps, filteredDapps)

      if (userDappsRadiks.newDapps.length > 0) {
        this.props.addDappsToList(userDappsRadiks.newDapps)
      }

      if (!userIntro || !userDappsRadiks || !following) {
        throw new Error('User intro data does not exist')
      }

      this.setState({
        userInfo: {
          ...JSON.parse(userIntro) || {},
          dapps: _.slice(userDappsRadiks.dapps, 0, 21),
          following: JSON.parse(following),
          profile,
        },
        loading: false,
        fileExists: !!userIntro,
      })
    } catch (e) {
      this.setState({
        userInfo: {
          ...JSON.parse(userIntro) || {},
          following: JSON.parse(following) || [],
          profile,
          dapps: _.slice(userDappsRadiks.dapps, 0, 21),
        },
        loading: false,
        fileExists: !!userIntro,
      })
    }
  }

  onCreateEdit = () => {
    this.setState({ displayView: false })
  }

  onShowDisplay = () => {
    this.setState({ displayView: true })
  }

  onSubmit = (data) => {
    const { description } = data

    this.setState({
      userInfo: { ...this.state.userInfo, description },
      displayView: true
    })
  }

  onCancel = () => {
    this.setState({ displayView: true })
  }

  addDefaultSrc = (evt) => {
    evt.target.src = 'https://i.imgur.com/w1ur3Lq.jpg'
  }

  requestUserShares = () => {
    const { username, shares } = this.props
    const sharesLength = shares.list.length
    this.props.requestUserShares({ username, offset: sharesLength })
  }

  handleScroll = () => {
    const { bottomReached } = this.state
    const { shares } = this.props

    const html = document.documentElement; // get the html element
    // window.innerHeight - Height (in pixels) of the browser window viewport including, if rendered, the horizontal scrollbar.
    // html.offsetHeight - read-only property returns the height of an element, including vertical padding and borders, as an integer.
    const windowHeight = "innerHeight" in window ? window.innerHeight : html.offsetHeight;
    const body = document.body; // get the document body
    const docHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight); // Find the max value of the overall doc
    const windowBottom = windowHeight + window.pageYOffset; // Viewport + height offset post scroll

    /**
     * if windowBottom is larger then you know you reached the bottom
    */
    if (windowBottom >= docHeight) {
      this.setState({ bottomReached: true }, () => {
        if (!shares.full) {
          this.requestUserShares()
        }
      });
    } else if ((windowBottom < docHeight) && bottomReached) {
      this.setState({ bottomReached: false });
    }
  }

  closeModal = () => {
    this.setState({ showModal: false })
  }

  openModal = (share) => {
    this.setState({
      showModal: true,
      currentShare: {
        id: share._id,
        text: share.text,
        imageFile: share.imageFile,
      }
    })
  }

  render() {
    const { sessionUser, defaultImgUrl } = this.context.state

    const {
      username,
      history,
      shares,
    } = this.props

    const {
      adminMode,
      bottomReached,
      loading,
      userInfo,
      displayView,
      fileExists,
      showModal
    } = this.state

    const src = _.get(userInfo, 'profile.image[0].contentUrl', defaultImgUrl)

    return (
      <Container>
        <Columns>
          <Columns.Column size={12}>
            <Media className="username__hero">
              <Media.Item renderAs="figure" position="left">
                {
                  loading ?
                  <HeroAvatarLoader /> :
                  <Image
                    className="username__avatar"
                    alt="100x100"
                    renderAs="p"
                    src={src}
                    style={{ margin: 0 }}
                    />
                }
              </Media.Item>
              <Media.Item
                position="center"
                style={{ alignSelf: 'center' }}
              >
                <Heading size={4} style={{ color: 'white' }}>{_.get(userInfo, 'profile.name', username)}</Heading>
                <Heading subtitle size={6} style={{ color: 'white' }}>
                  {username}
                </Heading>
                <FollowButton
                  defaultImgUrl={defaultImgUrl}
                  sessionUser={sessionUser}
                  setSessionUserState={this.context.setSessionUserState}
                  userInfo={userInfo}
                  username={username}
                />
              </Media.Item>
            </Media>
          </Columns.Column>
        </Columns>

        <Columns className="mt-half">
          <Columns.Column size={5}>
            {
              /*
              <div className="username__description mb-one">
                <Loadable loading={loading}>
                  <UserDescription
                    adminMode={adminMode}
                    displayView={displayView}
                    fileExists={fileExists}
                    loading={loading}
                    sessionUser={sessionUser}
                    userInfo={userInfo}
                    usename={username}
                    onCreateEdit={this.onCreateEdit}
                    onCancel={this.onCancel}
                    onSubmit={this.onSubmit}
                    />
                </Loadable>
              </div>
              */
            }

            <div className="username__dapps mb-one">
              <UserDapps
                adminMode={adminMode}
                loading={loading}
                userInfo={userInfo}
              />
            </div>

            <div className="username__following mb-one">
              <UserFollowing
                adminMode={adminMode}
                history={history}
                loading={loading}
                userInfo={userInfo}
              />
            </div>
          </Columns.Column>

          <Columns.Column
            size={7}
            ref={(rightElement) => this.rightElement = rightElement}
          >
            <Columns>
              <Columns.Column size={12}>
                {
                  /*
                  {
                    adminMode &&
                    <Card className="mb-one">
                      <Card.Content>
                        <Content>
                          <Loadable loading={shares.loading && shares.list.length === 0}>
                            <ShareForm username={username} />
                          </Loadable>
                        </Content>
                      </Card.Content>
                    </Card>
                  }
                  {
                    !adminMode && _.isEqual(shares.length, 0) &&
                    <NoShares username={username} />
                  }
                  <CSSTransitionGroup
                    transitionName="share-list-item-transition"
                    transitionEnterTimeout={500}
                    transitionLeaveTimeout={300}
                  >
                    {
                      _.map(shares.list, (share, index) => {
                        const cardClass = _.isEqual(index, 0) ? '' : 'mt-one'

                        return (
                          <ShareListItem
                            key={share._id}
                            cardClass={cardClass}
                            share={share}
                            username={username}
                            onEditClick={this.openModal}
                          />
                        )
                      })
                    }
                  </CSSTransitionGroup>
                  {
                    bottomReached && !shares.full && <BarLoader style={{ height: '200px' }} />
                  }
                  */
                }
                <UserDescription
                  adminMode={adminMode}
                  displayView={displayView}
                  fileExists={fileExists}
                  loading={loading}
                  sessionUser={sessionUser}
                  userInfo={userInfo}
                  usename={username}
                  onCreateEdit={this.onCreateEdit}
                  onCancel={this.onCancel}
                  onSubmit={this.onSubmit}
                />
              </Columns.Column>
            </Columns>
          </Columns.Column>
        </Columns>
        <Modal
          show={showModal}
          onClose={this.closeModal}
          closeOnEsc
        >
          <Modal.Content>
            <Section style={{ backgroundColor: 'white' }}>
              <ShareForm
                username={username}
                currentShare={this.state.currentShare}
                onCancel={this.closeModal}
                onComplete={this.closeModal}
              />
            </Section>
          </Modal.Content>
        </Modal>
      </Container>
    )
  }
}

const mapStateToProps = (state, ownProps) => {
  const { username } = ownProps
  const { share } = state

  const shares = {
    list: _.filter(state.share.shares.list, (share) => share.username === username),
    full: share.shares.full,
    loading: share.shares.loading
  }

  return {
    shares,
  }
}

UsernamePage.contextType = UserContext
export default withRouter(connect(mapStateToProps, {
  requestUserShares,
  addDappsToList,
})(UsernamePage))