function log(msg) {
  const p = document.createElement("p");
  p.innerText = msg;
  document.body.append(p);
}

log("Script started");

const pc = new RTCPeerConnection({
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject"
    }
  ]
});

pc.oniceconnectionstatechange = () => {
  const p = document.createElement("p");
  p.innerText = "ICE State: " + pc.iceConnectionState;
  document.body.append(p);
};



let localStream;
let remoteStream = new MediaStream();

const localVideo = document.createElement("video");
const remoteVideo = document.createElement("video");
localVideo.autoplay = true;
localVideo.muted = true;
remoteVideo.autoplay = true;

document.body.append(localVideo, remoteVideo);
remoteVideo.srcObject = remoteStream;

const params = new URLSearchParams(window.location.search);
let roomId = params.get("room");

if (!roomId) {
  roomId = Math.floor(Math.random() * 1000000).toString();
  window.location.search = "?room=" + roomId;
}

const roomRef = firebase.database().ref("webrtc-rooms/" + roomId);
roomRef.remove();

async function start() {
  log("Getting camera...");
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  log("Camera OK");

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => {
    e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    log("Remote stream received");
  };

  pc.onicecandidate = e => {
    if (e.candidate) {
      roomRef.child("ice").push(e.candidate.toJSON());
      log("ICE sent");
    }
  };

  const offerSnap = await roomRef.child("offer").once("value");

  if (!offerSnap.exists()) {
    log("I am caller");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await roomRef.child("offer").set(offer);

    roomRef.child("answer").on("value", async snap => {
      if (snap.exists()) {
        log("Answer received");
        await pc.setRemoteDescription(new RTCSessionDescription(snap.val()));
      }
    });

  } else {
    log("I am answerer");
    await pc.setRemoteDescription(new RTCSessionDescription(offerSnap.val()));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await roomRef.child("answer").set(answer);
  }

  roomRef.child("ice").on("child_added", snap => {
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
    log("ICE received");
  });
}

start();



