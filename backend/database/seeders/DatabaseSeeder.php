<?php

namespace Database\Seeders;

use App\Models\Breed;
use App\Models\Cow;
use App\Models\User;
use App\Support\Document;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['Nelore', 'Holandesa', 'Girolando', 'Gir Leiteiro', 'Angus', 'Brahman', 'Jersey', 'Guzerá', 'Mestiço'] as $name) {
            Breed::firstOrCreate(['name' => $name]);
        }

        $password = config('boinarede.demo.password');
        User::firstOrCreate(['email' => config('boinarede.demo.admin_email')], [
            'name' => 'Administrador', 'password' => $password, 'phone' => '(11) 99999-0000', 'city' => 'São Paulo', 'state' => 'SP',
        ])->forceFill(['role' => 'admin'])->save();
        $seller = User::firstOrCreate(['email' => config('boinarede.demo.seller_email')], [
            'name' => 'Fazenda Vale Verde', 'password' => $password, 'document' => '52998224725',
            'document_hash' => Document::hash('52998224725'), 'phone' => '(34) 99999-0001',
            'city' => 'Uberaba', 'state' => 'MG', 'farm_name' => 'Fazenda Vale Verde',
        ]);
        User::firstOrCreate(['email' => config('boinarede.demo.buyer_email')], [
            'name' => 'Comprador Demo', 'password' => $password, 'document' => '11144477735',
            'document_hash' => Document::hash('11144477735'), 'phone' => '(11) 99999-0002',
            'city' => 'Ribeirão Preto', 'state' => 'SP',
        ]);

        if (Cow::count() === 0) {
            $breeds = Breed::pluck('id', 'name');
            foreach ([
                ['Vaca Girolando em lactação', 'Girolando', 'leite', 42, 480, 4800],
                ['Novilha Nelore PO', 'Nelore', 'corte', 24, 390, 3900],
                ['Touro Angus reprodutor', 'Angus', 'reproducao', 36, 820, 12500],
            ] as [$title, $breed, $purpose, $age, $weight, $price]) {
                $seller->cows()->make([
                    'title' => $title, 'breed_id' => $breeds[$breed], 'sex' => $purpose === 'reproducao' ? 'macho' : 'femea',
                    'age_months' => $age, 'weight_kg' => $weight, 'purpose' => $purpose, 'price' => $price,
                    'city' => 'Uberaba', 'state' => 'MG',
                    'vaccinated' => true, 'vaccinations' => ['Aftosa', 'Brucelose'],
                    'description' => 'Animal saudável, com documentação em dia.',
                ])->forceFill(['status' => 'active', 'published_at' => now()])->save();
            }
        }
    }
}
