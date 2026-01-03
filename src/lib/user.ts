export async function fetchUsersWithAuth(fetchWithAuth: any) {
  const res = await fetchWithAuth("http://localhost:5000/users", {
    method: "GET",
  });

  if (res.status === 401 || res.status === 403) {
    return null; 
  }

  if (!res.ok) {
    const text = await res.text();
    console.error("Error respons server:", text);
    throw new Error("Gagal mengambil data user");
  }

  const data = await res.json();
  console.log("Data user berhasil diambil:", data);
  return data;
}
