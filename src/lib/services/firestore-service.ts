import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryConstraint,
  type WithFieldValue,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";

export async function getDocument<T>(collectionName: string, id: string) {
  const snapshot = await getDoc(doc(getFirebaseDb(), collectionName, id));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...(snapshot.data() as T) };
}

export async function setDocument<T extends DocumentData>(
  collectionName: string,
  id: string,
  data: WithFieldValue<T>
) {
  await setDoc(doc(getFirebaseDb(), collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function updateDocument(
  collectionName: string,
  id: string,
  data: DocumentData
) {
  await updateDoc(doc(getFirebaseDb(), collectionName, id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

export async function createDocument<T extends DocumentData>(
  collectionName: string,
  data: WithFieldValue<T>
) {
  const ref = await addDoc(collection(getFirebaseDb(), collectionName), {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function removeDocument(collectionName: string, id: string) {
  await deleteDoc(doc(getFirebaseDb(), collectionName, id));
}

export async function listDocuments<T>(
  collectionName: string,
  constraints: QueryConstraint[] = []
) {
  const snapshot = await getDocs(
    query(collection(getFirebaseDb(), collectionName), ...constraints)
  );

  return snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as T),
  }));
}

export { where, orderBy, limit, query };
