
import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

export async function login(email,password){
  return signInWithEmailAndPassword(auth,email,password);
}

export async function signupWithInvite(name,email,password,code){
  const ref = doc(db,"invites",code);
  const snap = await getDoc(ref);
  if(!snap.exists()) throw "Convite inválido";
  const data = snap.data();
  const cred = await createUserWithEmailAndPassword(auth,email,password);
  await setDoc(doc(db,"users",cred.user.uid),{
    name,email,role:data.role,createdAt:Date.now()
  });
  await updateDoc(ref,{used:true});
}
