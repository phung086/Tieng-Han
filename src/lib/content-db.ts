const DB_NAME = "haneul-content";
const DB_VERSION = 1;
const STORE_NAME = "runtime";
const ACTIVE_COURSE_KEY = "active-course";

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      reject(new Error("IndexedDB is not available."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Cannot open IndexedDB."));
  });
}

export async function readStoredCourse() {
  const database = await openDatabase();

  try {
    return await new Promise<unknown>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(ACTIVE_COURSE_KEY);

      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error ?? new Error("Cannot read course."));
    });
  } finally {
    database.close();
  }
}

export async function writeStoredCourse(value: unknown) {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.put(value, ACTIVE_COURSE_KEY);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Cannot save course."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Course save aborted."));
    });
  } finally {
    database.close();
  }
}

export async function clearStoredCourse() {
  const database = await openDatabase();

  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      store.delete(ACTIVE_COURSE_KEY);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("Cannot clear course."));
    });
  } finally {
    database.close();
  }
}
