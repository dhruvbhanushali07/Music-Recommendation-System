
import { useEffect, useRef, useState } from "react";
import "./App.css";

const songs = [
  {
    id: 1,
    title: "Midnight Dreams",
    artist: "Alex Morgan",
    genre: "Electronic",
    audio: "/audio/song1.mp3",
    color: "purple",
    emoji: "🌌",
  },
  {
    id: 2,
    title: "Golden Hour",
    artist: "James Carter",
    genre: "Pop",
    audio: "/audio/song2.mp3",
    color: "orange",
    emoji: "🌅",
  },
  {
    id: 3,
    title: "Lost in Waves",
    artist: "Luna Sky",
    genre: "Chill",
    audio: "/audio/song3.mp3",
    color: "blue",
    emoji: "🌊",
  },
];

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function App() {
  const audioRef = useRef(null);

  // Playback tracking
  const listenedRef = useRef(new Set());
  const playbackSecondsRef = useRef({});
  const lastPlaybackTimeRef = useRef(null);

  // Navigation
  const [page, setPage] = useState("discover");

  // Music player
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  // User preferences
  const [liked, setLiked] = useState(() =>
    readStorage("tunematch-liked", [])
  );

  const [disliked, setDisliked] = useState(() =>
    readStorage("tunematch-disliked", [])
  );

  // Playlists
  const [playlists, setPlaylists] = useState(() =>
    readStorage("tunematch-playlists", [])
  );

  const [activePlaylistId, setActivePlaylistId] = useState(() =>
    readStorage("tunematch-active-playlist", null)
  );

  const [playlistName, setPlaylistName] = useState("");
  const [playlistError, setPlaylistError] = useState("");

  // Playlist popup
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [pendingSongId, setPendingSongId] = useState(null);

  // Activity
  const [events, setEvents] = useState([]);

  const currentSong = songs[currentIndex];

  const activePlaylist = playlists.find(
    (playlist) => playlist.id === activePlaylistId
  );

  const isLiked = liked.includes(currentSong.id);
  const isDisliked = disliked.includes(currentSong.id);

  // Save data in browser
  useEffect(() => {
    localStorage.setItem("tunematch-liked", JSON.stringify(liked));
  }, [liked]);

  useEffect(() => {
    localStorage.setItem("tunematch-disliked", JSON.stringify(disliked));
  }, [disliked]);

  useEffect(() => {
    localStorage.setItem("tunematch-playlists", JSON.stringify(playlists));
  }, [playlists]);

  useEffect(() => {
    localStorage.setItem(
      "tunematch-active-playlist",
      JSON.stringify(activePlaylistId)
    );
  }, [activePlaylistId]);

  // Record user interactions
  const recordEvent = (type, song = currentSong) => {
    const event = {
      songId: song.id,
      song: song.title,
      type,
      timestamp: new Date().toISOString(),
    };

    setEvents((previous) => [...previous, event]);

    console.log("TuneMatch Event:", event);
  };

  // Load song when selection changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    lastPlaybackTimeRef.current = null;
    audio.load();

    setCurrentTime(0);
    setProgress(0);
    setDuration(0);

    if (isPlaying) {
      audio.play().catch((error) => {
        console.error("Playback error:", error);
        setIsPlaying(false);
      });
    }
  }, [currentIndex]);

  // Play / Pause
  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
        recordEvent("play");
      } catch (error) {
        console.error("Playback failed:", error);
      }
    } else {
      audio.pause();
      recordEvent("pause");
    }
  };

  // Next song
  const nextSong = (manual = true) => {
    if (manual) {
      recordEvent("skip");
    }

    lastPlaybackTimeRef.current = null;

    setCurrentIndex((previous) => (previous + 1) % songs.length);
    setIsPlaying(true);
  };

  // Previous song
  const previousSong = () => {
    const audio = audioRef.current;

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      lastPlaybackTimeRef.current = 0;
      return;
    }

    lastPlaybackTimeRef.current = null;

    setCurrentIndex(
      (previous) => (previous - 1 + songs.length) % songs.length
    );

    setIsPlaying(true);
  };

  // Track actual playback time and progress
  const updateProgress = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const time = audio.currentTime;

    setCurrentTime(time);
    setDuration(audio.duration || 0);
    setProgress(
      audio.duration ? (time / audio.duration) * 100 : 0
    );

    // Count only actual playback progression.
    // Large jumps are ignored so seeking doesn't count as listening.
    if (!audio.paused) {
      const lastTime = lastPlaybackTimeRef.current;

      if (lastTime !== null) {
        const difference = time - lastTime;

        if (difference > 0 && difference <= 2.5) {
          playbackSecondsRef.current[currentSong.id] =
            (playbackSecondsRef.current[currentSong.id] || 0) +
            difference;
        }
      }

      lastPlaybackTimeRef.current = time;
    }

    // Record once after 20 seconds of accumulated playback
    if (
      (playbackSecondsRef.current[currentSong.id] || 0) >= 20 &&
      !listenedRef.current.has(currentSong.id)
    ) {
      listenedRef.current.add(currentSong.id);
      recordEvent("listened_20_seconds");
    }
  };

  // Audio event handlers
  const handleAudioPlay = () => {
    lastPlaybackTimeRef.current = audioRef.current?.currentTime ?? 0;
    setIsPlaying(true);
  };

  const handleAudioPause = () => {
    lastPlaybackTimeRef.current = null;
    setIsPlaying(false);
  };

  // Seek
  const seekSong = (event) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const newTime = (Number(event.target.value) / 100) * duration;

    audio.currentTime = newTime;
    lastPlaybackTimeRef.current = newTime;

    setCurrentTime(newTime);
    setProgress(Number(event.target.value));
  };

  // Like / Unlike
  const toggleLike = () => {
    const alreadyLiked = liked.includes(currentSong.id);

    setLiked((previous) =>
      alreadyLiked
        ? previous.filter((id) => id !== currentSong.id)
        : [...previous, currentSong.id]
    );

    if (!alreadyLiked) {
      setDisliked((previous) =>
        previous.filter((id) => id !== currentSong.id)
      );
    }

    recordEvent(alreadyLiked ? "unlike" : "like");
  };

  // Dislike / Undo dislike
  const toggleDislike = () => {
    const alreadyDisliked = disliked.includes(currentSong.id);

    setDisliked((previous) =>
      alreadyDisliked
        ? previous.filter((id) => id !== currentSong.id)
        : [...previous, currentSong.id]
    );

    if (!alreadyDisliked) {
      setLiked((previous) =>
        previous.filter((id) => id !== currentSong.id)
      );
    }

    recordEvent(
      alreadyDisliked ? "remove_dislike" : "dislike"
    );
  };

  // Playlist popup
  const openPlaylistModal = () => {
    setPendingSongId(currentSong.id);
    setPlaylistName("");
    setPlaylistError("");
    setPlaylistModalOpen(true);
  };

  const closePlaylistModal = () => {
    setPlaylistModalOpen(false);
    setPendingSongId(null);
    setPlaylistError("");
  };

  // Add / Remove song from a selected playlist
  const toggleSongInPlaylist = (playlistId, songId) => {
    const selectedPlaylist = playlists.find(
      (playlist) => playlist.id === playlistId
    );

    if (!selectedPlaylist) return;

    const alreadyAdded = selectedPlaylist.songs.includes(songId);

    setPlaylists((previous) =>
      previous.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              songs: alreadyAdded
                ? playlist.songs.filter((id) => id !== songId)
                : [...playlist.songs, songId],
            }
          : playlist
      )
    );

    const song = songs.find((item) => item.id === songId);

    if (song) {
      recordEvent(
        alreadyAdded
          ? "removed_from_playlist"
          : "added_to_playlist",
        song
      );
    }
  };

  // Create playlist with optional automatic song addition
  const createPlaylist = (event, addCurrentSong = false) => {
    event.preventDefault();

    const name = playlistName.trim().replace(/\s+/g, " ");

    if (!name) {
      setPlaylistError("Please enter a playlist name.");
      return;
    }

    // Case-insensitive duplicate prevention
    const duplicate = playlists.some(
      (playlist) =>
        playlist.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setPlaylistError("A playlist with this name already exists.");
      return;
    }

    const songToAdd = addCurrentSong ? pendingSongId : null;

    const newPlaylist = {
      id: Date.now() + Math.random(),
      name,
      songs: songToAdd !== null ? [songToAdd] : [],
    };

    setPlaylists((previous) => [...previous, newPlaylist]);
    setActivePlaylistId(newPlaylist.id);

    recordEvent("playlist_created");

    if (songToAdd !== null) {
      const song = songs.find((item) => item.id === songToAdd);
      if (song) recordEvent("added_to_playlist", song);
    }

    setPlaylistName("");
    setPlaylistError("");

    if (addCurrentSong) {
      closePlaylistModal();
    }
  };

  // Remove song from playlist
  const removeFromPlaylist = (playlistId, songId) => {
    setPlaylists((previous) =>
      previous.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              songs: playlist.songs.filter((id) => id !== songId),
            }
          : playlist
      )
    );

    const song = songs.find((item) => item.id === songId);

    if (song) recordEvent("removed_from_playlist", song);
  };

  // Delete playlist
  const deletePlaylist = (playlistId) => {
    setPlaylists((previous) =>
      previous.filter((playlist) => playlist.id !== playlistId)
    );

    if (activePlaylistId === playlistId) {
      setActivePlaylistId(null);
    }
  };

  // Play selected song
  const selectSong = (index) => {
    if (index === currentIndex) {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = 0;
        lastPlaybackTimeRef.current = 0;

        audio.play().catch(console.error);
      }

      setIsPlaying(true);
    } else {
      lastPlaybackTimeRef.current = null;
      setCurrentIndex(index);
      setIsPlaying(true);
    }

    recordEvent("song_selected", songs[index]);
  };

  // Format time
  const formatTime = (time) => {
    if (!Number.isFinite(time)) return "0:00";

    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);

    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Song card
  const SongCard = ({ song }) => {
    const index = songs.findIndex((item) => item.id === song.id);

    return (
      <div className="song-card">
        <div
          className={`cover ${song.color}`}
          onClick={() => selectSong(index)}
        >
          <span>{song.emoji}</span>
          <button
            className="cover-play"
            aria-label={`Play ${song.title}`}
          >
            ▶
          </button>
        </div>

        <h3>{song.title}</h3>
        <p>{song.artist}</p>
        <span className="genre">{song.genre}</span>
      </div>
    );
  };

  // Reusable song row
  const SongRow = ({ song, action, actionLabel = "Remove" }) => {
    const index = songs.findIndex((item) => item.id === song.id);

    return (
      <div className="song-row">
        <div className={`row-cover ${song.color}`}>
          {song.emoji}
        </div>

        <div className="row-details">
          <strong>{song.title}</strong>
          <span>{song.artist}</span>
        </div>

        <span className="row-genre">{song.genre}</span>

        <button
          className="row-play"
          onClick={() => selectSong(index)}
          aria-label={`Play ${song.title}`}
        >
          ▶
        </button>

        <button className="row-remove" onClick={action}>
          {actionLabel}
        </button>
      </div>
    );
  };

  const modalSong = songs.find(
    (song) => song.id === pendingSongId
  );

  return (
    <div className="app">

      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <span className="brand-icon">♫</span>

          <div>
            <h2>TuneMatch</h2>
            <p>DISCOVER YOUR SOUND</p>
          </div>
        </div>

        <p className="nav-heading">MENU</p>

        <nav>
          <button
            className={page === "discover" ? "active" : ""}
            onClick={() => setPage("discover")}
          >
            <span>⌂</span> Discover
          </button>

          <button
            className={page === "liked" ? "active" : ""}
            onClick={() => setPage("liked")}
          >
            <span>♡</span> Liked Songs
            <small>{liked.length}</small>
          </button>

          <button
            className={page === "playlists" ? "active" : ""}
            onClick={() => setPage("playlists")}
          >
            <span>♫</span> My Playlists
            <small>{playlists.length}</small>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-glow">✦</div>
          <h3>Your music.<br />Your identity.</h3>
          <p>TuneMatch learns what you love.</p>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">

        {/* DISCOVER PAGE */}
        {page === "discover" && (
          <>
            <header className="topbar">
              <div>
                <p className="eyebrow">YOUR PERSONAL MUSIC SPACE</p>
                <h1>Discover Music</h1>
              </div>

              <div className="profile">🎧</div>
            </header>

            <section className="hero">
              <div className="hero-content">
                <p className="eyebrow">MUSIC WITHOUT LIMITS</p>

                <h2>
                  Find your next
                  <br />
                  favourite sound.
                </h2>

                <p>
                  Discover music that matches your taste and mood.
                </p>

                <button
                  className="hero-button"
                  onClick={() =>
                    document.getElementById("explore")?.scrollIntoView({
                      behavior: "smooth",
                    })
                  }
                >
                  Explore Music <span>→</span>
                </button>
              </div>

              <div className="hero-art">♫</div>
              <div className="hero-orb"></div>
            </section>

            <section className="section" id="explore">
              <div className="section-heading">
                <div>
                  <h2>Explore Tracks</h2>
                  <p>Find something new to fall in love with.</p>
                </div>

                <span>{songs.length} tracks</span>
              </div>

              <div className="song-list">
                {songs.map((song) => (
                  <SongCard song={song} key={song.id} />
                ))}
              </div>
            </section>

            <section className="recommendation-section">
              <div>
                <p className="eyebrow">POWERED BY YOUR TASTE</p>
                <h2>Made for your ears.</h2>
                <p>
                  Your listening habits will help TuneMatch
                  discover music that feels like you.
                </p>
              </div>

              <div className="recommend-placeholder">
                <span>✧</span>
                <h3>Your recommendations are waiting.</h3>
                <p>
                  Listen to songs and interact to build your taste profile.
                </p>
              </div>
            </section>
          </>
        )}

        {/* LIKED SONGS PAGE */}
        {page === "liked" && (
          <>
            <header className="page-header">
              <div className="large-icon liked-icon">♥</div>

              <div>
                <p className="eyebrow">YOUR PERSONAL COLLECTION</p>
                <h1>Liked Songs</h1>
                <p>{liked.length} songs in your collection</p>
              </div>
            </header>

            {liked.length === 0 ? (
              <div className="empty-state">
                <span>♡</span>
                <h2>No liked songs yet</h2>
                <p>
                  Like songs while listening and they'll appear here.
                </p>

                <button onClick={() => setPage("discover")}>
                  Discover Music
                </button>
              </div>
            ) : (
              <div className="song-table">
                {songs
                  .filter((song) => liked.includes(song.id))
                  .map((song) => (
                    <SongRow
                      key={song.id}
                      song={song}
                      action={() => {
                        setLiked((previous) =>
                          previous.filter((id) => id !== song.id)
                        );

                        recordEvent("unlike", song);
                      }}
                      actionLabel="♥"
                    />
                  ))}
              </div>
            )}
          </>
        )}

        {/* PLAYLISTS PAGE */}
        {page === "playlists" && (
          <>
            <header className="page-header">
              <div className="large-icon playlist-icon">♫</div>

              <div>
                <p className="eyebrow">ORGANISE YOUR MUSIC</p>
                <h1>My Playlists</h1>
                <p>Create collections of songs you love.</p>
              </div>
            </header>

            <form
              className="create-playlist"
              onSubmit={(event) => createPlaylist(event, false)}
            >
              <div>
                <h3>Create a new playlist</h3>
                <p>Give your music collection a unique name.</p>
              </div>

              <input
                value={playlistName}
                onChange={(event) => {
                  setPlaylistName(event.target.value);
                  setPlaylistError("");
                }}
                placeholder="e.g. Late Night Vibes"
                maxLength={40}
              />

              <button type="submit" disabled={!playlistName.trim()}>
                + Create
              </button>

              {playlistError && (
                <p className="playlist-error">{playlistError}</p>
              )}
            </form>

            {playlists.length === 0 ? (
              <div className="empty-state">
                <span>♫</span>
                <h2>No playlists created</h2>
                <p>
                  Create your first playlist to start collecting music.
                </p>
              </div>
            ) : (
              <>
                <div className="playlist-grid">
                  {playlists.map((playlist) => (
                    <button
                      className={`playlist-card ${
                        activePlaylistId === playlist.id
                          ? "playlist-selected"
                          : ""
                      }`}
                      key={playlist.id}
                      onClick={() =>
                        setActivePlaylistId(playlist.id)
                      }
                    >
                      <span>♫</span>
                      <strong>{playlist.name}</strong>
                      <small>{playlist.songs.length} songs</small>
                    </button>
                  ))}
                </div>

                {activePlaylist && (
                  <section className="playlist-detail">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">SELECTED PLAYLIST</p>
                        <h2>{activePlaylist.name}</h2>
                        <p>{activePlaylist.songs.length} songs</p>
                      </div>

                      <button
                        className="delete-playlist"
                        onClick={() => deletePlaylist(activePlaylist.id)}
                      >
                        Delete playlist
                      </button>
                    </div>

                    {activePlaylist.songs.length === 0 ? (
                      <div className="empty-state compact">
                        <span>＋</span>
                        <h3>This playlist is empty</h3>
                        <p>
                          Play a song and use the + button in the
                          player to add it here.
                        </p>

                        <button onClick={() => setPage("discover")}>
                          Explore songs
                        </button>
                      </div>
                    ) : (
                      <div className="song-table">
                        {songs
                          .filter((song) =>
                            activePlaylist.songs.includes(song.id)
                          )
                          .map((song) => (
                            <SongRow
                              key={song.id}
                              song={song}
                              action={() =>
                                removeFromPlaylist(
                                  activePlaylist.id,
                                  song.id
                                )
                              }
                            />
                          ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}


      </main>

      {/* PLAYLIST SELECTION MODAL */}
      {playlistModalOpen && (
        <div
          className="playlist-modal-overlay"
          onClick={closePlaylistModal}
        >
          <div
            className="playlist-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="playlist-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">ORGANISE YOUR MUSIC</p>
                <h2 id="playlist-modal-title">Add to Playlist</h2>
                <p>{modalSong?.title}</p>
              </div>

              <button
                className="modal-close"
                onClick={closePlaylistModal}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="modal-playlist-list">
              {playlists.length === 0 ? (
                <div className="modal-empty">
                  <span>♫</span>
                  <h3>No playlists yet</h3>
                  <p>Create your first playlist below.</p>
                </div>
              ) : (
                playlists.map((playlist) => {
                  const alreadyAdded =
                    playlist.songs.includes(pendingSongId);

                  return (
                    <div
                      className="modal-playlist-row"
                      key={playlist.id}
                    >
                      <div className="modal-playlist-icon">♫</div>

                      <div className="modal-playlist-info">
                        <strong>{playlist.name}</strong>
                        <span>
                          {playlist.songs.length} songs
                        </span>
                      </div>

                      <button
                        className={
                          alreadyAdded ? "modal-added" : "modal-add"
                        }
                        onClick={() =>
                          toggleSongInPlaylist(
                            playlist.id,
                            pendingSongId
                          )
                        }
                      >
                        {alreadyAdded ? "✓ Added" : "+ Add"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="modal-create-section">
              <h3>Create a new playlist</h3>

              <form
                onSubmit={(event) => createPlaylist(event, true)}
              >
                <input
                  value={playlistName}
                  onChange={(event) => {
                    setPlaylistName(event.target.value);
                    setPlaylistError("");
                  }}
                  placeholder="Enter playlist name..."
                  maxLength={40}
                />

                <button
                  type="submit"
                  disabled={!playlistName.trim()}
                >
                  Create & Add
                </button>
              </form>

              {playlistError && (
                <p className="playlist-error">{playlistError}</p>
              )}
            </div>

            <button
              className="modal-done"
              onClick={closePlaylistModal}
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* MUSIC PLAYER */}
      <footer className="player">

        <audio
          ref={audioRef}
          src={currentSong.audio}
          onTimeUpdate={updateProgress}
          onLoadedMetadata={() => {
            setDuration(audioRef.current?.duration || 0);
          }}
          onPlay={handleAudioPlay}
          onPause={handleAudioPause}
          onEnded={() => {
            recordEvent("song_completed");
            nextSong(false);
          }}
        />

        <div className="player-song">
          <div className={`mini-cover ${currentSong.color}`}>
            {currentSong.emoji}
          </div>

          <div className="player-song-info">
            <strong>{currentSong.title}</strong>
            <p>{currentSong.artist}</p>
          </div>
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button onClick={previousSong} title="Previous">
              ⏮
            </button>

            <button
              className="play-button"
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "Ⅱ" : "▶"}
            </button>

            <button
              onClick={() => nextSong()}
              title="Next"
            >
              ⏭
            </button>
          </div>

          <div className="progress-container">
            <span>{formatTime(currentTime)}</span>

            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={seekSong}
              className="progress-bar"
              aria-label="Song progress"
            />

            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="player-actions">
          <button
            className={isLiked ? "chosen" : ""}
            onClick={toggleLike}
            title={isLiked ? "Unlike song" : "Like song"}
          >
            {isLiked ? "♥" : "♡"}
          </button>

          <button
            className={
              isDisliked ? "chosen dislike-chosen" : ""
            }
            onClick={toggleDislike}
            title={isDisliked ? "Undo dislike" : "Dislike song"}
          >
            👎
          </button>

          <button
            onClick={openPlaylistModal}
            title="Add to playlist"
          >
            +
          </button>
        </div>

      </footer>
    </div>
  );
}

export default App;
