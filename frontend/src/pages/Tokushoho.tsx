import React from 'react';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

export function Tokushoho() {
  const navigate = useNavigate();

  return (
    <div className="max-w-3xl mx-auto p-8 font-sans text-[#0f1f10]">
      <button 
        onClick={() => navigate(-1)} 
        className="mb-6 flex items-center gap-1 text-gray-500 hover:text-gray-800 transition-colors bg-transparent border-none cursor-pointer p-0"
      >
        <ArrowBackIcon fontSize="small" /> 戻る
      </button>

      <h1 className="text-2xl font-bold mb-8 text-center">特定商取引法に基づく表記</h1>
      
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <tbody>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left w-1/3 font-bold text-gray-700">事業者の名称</th>
              <td className="border-b border-gray-200 p-4">村上 穂奈美</td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">運営統括責任者</th>
              <td className="border-b border-gray-200 p-4">村上 穂奈美</td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">事業者の連絡先</th>
              <td className="border-b border-gray-200 p-4">
                メールアドレス：support@streeeak.link<br />
                <span className="text-xs text-gray-500 mt-1 inline-block">※サービスに関するお問い合わせはメールにてお願いいたします。</span>
              </td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">販売価格</th>
              <td className="border-b border-gray-200 p-4">Premium Plan：月額300円（税込）</td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">商品代金以外の必要料金</th>
              <td className="border-b border-gray-200 p-4">当サイトのページの閲覧、サービスのご利用に必要なインターネット接続料金、通信料金等はお客様のご負担となります。</td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">支払い方法</th>
              <td className="border-b border-gray-200 p-4">クレジットカード決済（Stripe）</td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">代金の支払い時期</th>
              <td className="border-b border-gray-200 p-4 leading-relaxed">
                初回：申込時<br />
                次月以降：毎月、初回申込日と同日に自動決済
              </td>
            </tr>
            <tr>
              <th className="border-b border-gray-200 bg-[#f8faf8] p-4 text-left font-bold text-gray-700">サービスの提供時期</th>
              <td className="border-b border-gray-200 p-4">決済手続き完了後、すぐにご利用いただけます。</td>
            </tr>
            <tr>
              <th className="bg-[#f8faf8] p-4 text-left font-bold text-gray-700">返品・キャンセル・解約について</th>
              <td className="p-4 leading-relaxed">
                <strong className="text-gray-800">【解約について】</strong><br />
                サブスクリプションの解約は、設定画面よりいつでも行うことができます。解約手続き完了後、次回の決済は行われず、現在の有効期限まではプレミアム機能をご利用いただけます。<br /><br />
                <strong className="text-gray-800">【返品・返金について】</strong><br />
                デジタルコンテンツという商品の性質上、決済完了後の返品および返金には応じられません。
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}