const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

const localVideo = document.createElement("video");
const remoteVideo = document.createElement("video");

localVideo.autoplay = true;
localVideo.muted = true;
remoteVideo.autoplay = true;

document.body.append(localVideo, remoteVideo);

let localStream;
let remoteStream = new MediaStream();
remoteVideo.srcObject = remoteStream;

const params = new URLSearchParams(window.location.search);
let roomId = params.get("room");

if (!roomId) {
  roomId = Math.floor(Math.random() * 1000000);
  window.location.search = "?room=" + roomId;
}

const roomRef = firebase.database().ref("room-" + roomId);

const roomRef = firebase.database().ref("room-" + roomId);

// -------------------- MEDIA --------------------

async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });

  localVideo.srcObject = localStream;

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  pc.ontrack = event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  };

  pc.onicecandidate = event => {
    if (event.candidate) {
      roomRef.child("ice").push(event.candidate.toJSON());
    }
  };
}

// -------------------- SIGNALING --------------------

async function startCall() {
  const offerSnap = await roomRef.child("offer").once("value");

  if (!offerSnap.exists()) {
    // FIRST USER (creates offer)
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await roomRef.child("offer").set(offer);

    roomRef.child("answer").on("value", async snap => {
      if (snap.exists()) {
        await pc.setRemoteDescription(
          new RTCSessionDescription(snap.val())
        );
      }
    });

  } else {
    // SECOND USER (answers)
    await roomRef.child("ice").remove(); // clean old ICE

    await pc.setRemoteDescription(
      new RTCSessionDescription(offerSnap.val())
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await roomRef.child("answer").set(answer);
  }

  // ICE listener for both
  roomRef.child("ice").on("child_added", snap => {
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}

// -------------------- START --------------------

(async () => {
  await initMedia();
  await startCall();
})();


