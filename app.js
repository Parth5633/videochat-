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

const roomRef = firebase.database().ref("webrtc-room");

async function init() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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

  startCall();
}

async function startCall() {

  await roomRef.remove();   // ← ADD THIS LINE

  const offerSnap = await roomRef.child("offer").once("value");

  if (!offerSnap.exists()) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await roomRef.child("offer").set(offer);

    roomRef.child("answer").on("value", async snap => {
      if (snap.exists()) {
        await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
      }
    });

  } else {
    await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.val()));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await roomRef.child("answer").set(answer);
  }

  roomRef.child("ice").on("child_added", snap => {
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });
}

init();

