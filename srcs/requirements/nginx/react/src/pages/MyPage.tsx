import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useCallAPI from '../api';
import ContentBox from '../components/box/ContentBox';
import HoverButton from '../components/button/HoverButton';

interface User {
  nickname: string;
  profileImage: string;
}

interface Stats {
  wins: number;
  losses: number;
  ladderScore: number;
  recentHistory: string[];
}

interface MyPageProps {
  id: number;
  stats: Stats;
}

const MyPage: React.FC<MyPageProps> = ({ id, stats }) => {
  const [user, setUser] = useState<User | undefined>(undefined);
  const callAPI = useCallAPI();

  useEffect(() => {
    const fetchData = async () => {
      const data = await callAPI(`/api/v1/users/${id}`, false);
      setUser(data);
    };
    fetchData();
  }, []);

  return (
    <div className="flex flex-col items-center p-4">
      <ContentBox className="mb-4 w-full max-w-md border p-4">
        <h2 className="mt-2 text-2xl font-bold">
          {user?.nickname ?? 'Loading...'}
        </h2>
        <img
          className="rounded-full p-7"
          src={user?.profileImage}
          alt="Profile"
        />
      </ContentBox>
      <HoverButton
        onClick={() => callAPI('/profile')}
        className="mb-4 w-full max-w-md rounded border p-2.5"
      >
        Change Profile
      </HoverButton>
      <ContentBox className="mb-4 w-full max-w-md border p-4">
        <h3 className="mb-2 text-xl font-bold">Stats</h3>
        <p className="mb-1.5">Wins: {stats.wins}</p>
        <p className="mb-1.5">Losses: {stats.losses}</p>
        <p>Ladder Score: {stats.ladderScore}</p>
      </ContentBox>
      <ContentBox className="w-full max-w-md border p-4">
        <h3 className="mb-3 text-xl font-bold">Recent History</h3>
        <ul className="flex">
          {stats.recentHistory.map((history) => (
            <li
              key={uuidv4()}
              className={`mb-1 px-2 ${
                history === 'Win' ? 'text-blue-500' : 'text-red-500'
              }`}
            >
              {history}
            </li>
          ))}
        </ul>
      </ContentBox>
    </div>
  );
};

export default MyPage;
