document.getElementById("status").innerText = "Testing Firebase...";

const ref = firebase.database().ref("test");

ref.set("Hello from Firebase!");

ref.on("value", snap => {
  document.getElementById("status").innerText = snap.val();
});