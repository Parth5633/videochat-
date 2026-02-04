const pc = new RTCPeerConnection({
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
});

let localStream;
let remoteStream = new MediaStream();

const localVideo = document.createElement("video");
const remoteVideo = document.createElement("video");
localVideo.autoplay = true;
localVideo.muted = true;
remoteVideo.autoplay = true;

document.body.append(localVideo, remoteVideo);

remoteVideo.srcObject = remoteStream;

// ---------- UI ----------
const createBtn = document.createElement("button");
createBtn.innerText = "Create Room";
document.body.append(createBtn);

const joinInput = document.createElement("input");
joinInput.placeholder = "Enter Room ID";
document.body.append(joinInput);

const joinBtn = document.createElement("button");
joinBtn.innerText = "Join Room";
document.body.append(joinBtn);

// ---------- Media ----------
async function initMedia() {
  localStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  });
  localVideo.srcObject = localStream;

  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  pc.ontrack = e => {
    e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
  };
}

// ---------- Signaling ----------
async function setupRoom(roomId, isCaller) {
  const roomRef = firebase.database().ref("rooms/" + roomId);

  pc.onicecandidate = e => {
    if (e.candidate) {
      roomRef.child("ice").push(e.candidate.toJSON());
    }
  };

  roomRef.child("ice").on("child_added", snap => {
    pc.addIceCandidate(new RTCIceCandidate(snap.val()));
  });

  if (isCaller) {
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
    const offer = (await roomRef.child("offer").once("value")).val();
    await pc.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await roomRef.child("answer").set(answer);
  }
}

// ---------- Buttons ----------
createBtn.onclick = async () => {
  const roomId = Math.floor(Math.random() * 1000000).toString();
  alert("Room ID: " + roomId);
  await setupRoom(roomId, true);
};

joinBtn.onclick = async () => {
  const roomId = joinInput.value.trim();
  if (!roomId) return alert("Enter Room ID");
  await setupRoom(roomId, false);
};

// ---------- Start ----------
initMedia();
