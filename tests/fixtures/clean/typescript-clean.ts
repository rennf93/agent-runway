const API_URL = "https://api.example.com/users";

interface User {
    id: number;
    name: string;
}

async function fetchUsers(): Promise<User[]> {
    const response = await fetch(API_URL);
    return response.json();
}

function formatUser(user: User): string {
    return `${user.name} (${user.id})`;
}
